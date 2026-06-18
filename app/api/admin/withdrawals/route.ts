import { NextResponse, type NextRequest } from "next/server";

import { getShopByDomain } from "@/lib/shops/repository";
import { verifySessionToken } from "@/lib/shopify/session-token";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Embedded admin — list the current shop's withdrawal requests.
 *
 * Authenticated by the Shopify session token (Authorization: Bearer <token>):
 * the shop is derived from the verified token, never from a client-supplied
 * value, and every query is scoped by shop_id. See .claude/rules/supabase-rls.md.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const verified = token ? verifySessionToken(token) : null;
  if (!verified) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shop = await getShopByDomain(verified.shop);
  if (!shop) {
    return NextResponse.json({ withdrawals: [] });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select(
      "reference, customer_name, customer_email, order_number, order_verified, customer_country, deadline_status, deadline_at, status, created_at",
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // Stats over the whole shop (status column only, cheap).
  const { data: statusRows } = await supabase
    .from("withdrawals")
    .select("status")
    .eq("shop_id", shop.id);

  const stats = { total: 0, new: 0, in_progress: 0, done: 0, refused: 0 };
  for (const r of statusRows ?? []) {
    stats.total += 1;
    const s = r.status as keyof typeof stats;
    if (s in stats && s !== "total") stats[s] += 1;
  }

  return NextResponse.json({ withdrawals: data ?? [], stats });
}
