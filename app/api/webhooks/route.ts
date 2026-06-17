import { NextResponse, type NextRequest } from "next/server";

import { verifyWebhookHmac } from "@/lib/shopify/hmac";
import {
  markUninstalled,
  redactCustomer,
  redactShop,
} from "@/lib/shops/repository";

export const dynamic = "force-dynamic";

/**
 * Single webhook endpoint. Verify the HMAC over the RAW body BEFORE parsing,
 * then dispatch by `X-Shopify-Topic`. GDPR topics perform an immediate
 * synchronous purge (review requirement). Invalid/absent HMAC → 401.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

  if (!verifyWebhookHmac(rawBody, hmacHeader)) {
    return NextResponse.json({ error: "invalid_hmac" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shopDomain =
    req.headers.get("x-shopify-shop-domain")?.toLowerCase() ?? "";

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  switch (topic) {
    case "app/uninstalled": {
      if (shopDomain) await markUninstalled(shopDomain);
      break;
    }
    case "customers/redact": {
      const customer = payload.customer as { email?: string } | undefined;
      const email = customer?.email;
      const shop =
        (payload.shop_domain as string | undefined)?.toLowerCase() ?? shopDomain;
      if (shop && email) await redactCustomer(shop, email);
      break;
    }
    case "shop/redact": {
      const shop =
        (payload.shop_domain as string | undefined)?.toLowerCase() ?? shopDomain;
      if (shop) await redactShop(shop);
      break;
    }
    case "customers/data_request": {
      // We hold no customer data beyond withdrawal requests the merchant can
      // see in-app; acknowledge so Shopify marks the request handled.
      break;
    }
    default:
      // Unknown but authenticated topic — acknowledge to avoid retries.
      break;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
