import { NextResponse, type NextRequest } from "next/server";

import { getShopByDomain } from "@/lib/shops/repository";
import { verifySessionToken } from "@/lib/shopify/session-token";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["new", "in_progress", "done", "refused"] as const;

interface Ctx {
  params: { reference: string };
}

/** Resolve the shop from the session token, or null. */
async function authShop(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const verified = token ? verifySessionToken(token) : null;
  if (!verified) return null;
  return getShopByDomain(verified.shop);
}

/** GET — full detail of one withdrawal (scoped to the caller's shop). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const shop = await authShop(req);
  if (!shop) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { data: w } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("reference", params.reference)
    .maybeSingle();
  if (!w) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [{ data: events }, { data: notes }] = await Promise.all([
    supabase
      .from("withdrawal_events")
      .select("type, actor, note, created_at")
      .eq("withdrawal_id", w.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("withdrawal_notes")
      .select("id, body, created_at")
      .eq("withdrawal_id", w.id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    withdrawal: w,
    shop_domain: shop.shop_domain,
    events: events ?? [],
    notes: notes ?? [],
  });
}

/** POST — mutate: { action: "status", status } or { action: "note", body }. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const shop = await authShop(req);
  if (!shop) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { data: w } = await supabase
    .from("withdrawals")
    .select("id, status")
    .eq("shop_id", shop.id)
    .eq("reference", params.reference)
    .maybeSingle();
  if (!w) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.action === "status") {
    const status = String(body.status ?? "");
    if (!ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number])) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    const { error } = await supabase
      .from("withdrawals")
      .update({ status })
      .eq("id", w.id);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

    await supabase.from("withdrawal_events").insert({
      withdrawal_id: w.id,
      type: "status_changed",
      actor: "merchant",
      note: `${w.status} → ${status}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "note") {
    const text = String(body.body ?? "").trim();
    if (!text) return NextResponse.json({ error: "empty_note" }, { status: 400 });
    const { error } = await supabase
      .from("withdrawal_notes")
      .insert({ withdrawal_id: w.id, body: text });
    if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
