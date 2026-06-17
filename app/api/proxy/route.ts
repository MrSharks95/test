import { NextResponse, type NextRequest } from "next/server";

import { getDict } from "@/lib/i18n/proxy";
import { renderFormPage } from "@/lib/proxy/render";
import { verifyProxySignature } from "@/lib/shopify/hmac";
import { verifyOrder } from "@/lib/shopify/orders";
import {
  getActiveShopWithToken,
  getShopByDomain,
} from "@/lib/shops/repository";
import { sendAcknowledgement } from "@/lib/email/send";
import { computeDeadline } from "@/lib/withdrawal/deadline";
import { loadRuleSet } from "@/lib/withdrawal/rules";
import { createWithdrawal } from "@/lib/withdrawals/repository";
import type { WithdrawalItem } from "@/lib/withdrawal/types";

export const dynamic = "force-dynamic";

/**
 * App Proxy entry point — public withdrawal form (no customer login).
 *
 * MANDATORY: the Shopify proxy signature is verified on EVERY request (GET and
 * POST) before any work. Invalid/absent → 401. See
 * .claude/rules/shopify-app-proxy.md.
 */
export async function GET(req: NextRequest) {
  if (!verifyProxySignature(req.nextUrl.searchParams)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { locale, dict } = getDict(req.nextUrl.searchParams.get("locale"));
  return new NextResponse(renderFormPage(locale, dict), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (!verifyProxySignature(params)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const shop = params.get("shop")?.toLowerCase() ?? "";
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action;

  if (action === "verify_order") {
    return handleVerifyOrder(shop, body);
  }
  if (action === "submit") {
    return handleSubmit(shop, body);
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

async function handleVerifyOrder(
  shop: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const orderNumber = String(body.orderNumber ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!orderNumber || !email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // No active token (uninstalled / unknown shop) → degrade to manual entry.
  const active = await getActiveShopWithToken(shop);
  if (!active) {
    return NextResponse.json({
      order_verified: false,
      country: null,
      shopify_order_id: null,
      shipped_at: null,
      category: "standard",
      items: [],
    });
  }

  const result = await verifyOrder(shop, active.token, orderNumber, email);
  return NextResponse.json({
    order_verified: result.verified,
    country: result.country,
    shopify_order_id: result.shopifyOrderId,
    shipped_at: result.shippedAt,
    category: result.category,
    items: result.items,
  });
}

async function handleSubmit(
  shop: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const email = String(body.email ?? "").trim();
  const orderNumber = String(body.orderNumber ?? "").trim();
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!email || !orderNumber || rawItems.length === 0) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const shopRow = await getShopByDomain(shop);
  if (!shopRow) {
    return NextResponse.json({ error: "unknown_shop" }, { status: 404 });
  }

  const items: WithdrawalItem[] = rawItems.map((raw) => {
    const it = raw as Record<string, unknown>;
    return {
      title: String(it.title ?? "").trim(),
      quantity: Number(it.quantity) || 1,
      lineItemId: it.lineItemId ? String(it.lineItemId) : null,
    };
  });

  const name = String(body.name ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  const country =
    (body.country ? String(body.country) : null) ?? shopRow.default_country;
  const category = body.category ? String(body.category) : "standard";
  const shippedAt = body.shippedAt ? String(body.shippedAt) : null;

  // Deadline engine: country × category, with exemptions and fallbacks.
  const rules = await loadRuleSet(shopRow.default_country);
  const deadline = computeDeadline({
    shippedAt,
    country,
    category,
    receivedAt: shippedAt, // refund window anchored on delivery; ship date as proxy
    rules,
  });

  const created = await createWithdrawal({
    shopId: shopRow.id,
    customerName: name || null,
    customerEmail: email,
    orderNumber,
    shopifyOrderId:
      body.shopifyOrderId != null ? Number(body.shopifyOrderId) : null,
    orderVerified: body.orderVerified === true,
    customerCountry: country,
    items,
    reason: reason || null,
    shippedAt,
    deadlineAt: deadline.deadlineAt?.toISOString() ?? null,
    deadlineStatus: deadline.status,
    refundDeadlineAt: deadline.refundDeadlineAt?.toISOString() ?? null,
  });

  // Acknowledgement email (durable medium). Resilient & idempotent: it never
  // throws, so an email failure cannot block the withdrawal that was just created.
  await sendAcknowledgement(created.id);

  return NextResponse.json({ reference: created.reference });
}
