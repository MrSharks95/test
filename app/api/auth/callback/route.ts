import { NextResponse, type NextRequest } from "next/server";

import { shopifyConfig } from "@/lib/shopify";
import { verifyOAuthHmac } from "@/lib/shopify/hmac";
import { exchangeCodeForToken, isValidShopDomain } from "@/lib/shopify/oauth";
import { registerAppWebhooks } from "@/lib/shopify/webhooks";
import { upsertShopOnInstall } from "@/lib/shops/repository";

export const dynamic = "force-dynamic";

/**
 * OAuth step 2 — callback.
 * Verify HMAC + anti-CSRF state, exchange the code for an offline token, persist
 * the shop (token encrypted at rest), register webhooks, then hand off to the
 * embedded admin. Re-install is an upsert (no duplicate, reactivated).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const shop = params.get("shop")?.toLowerCase() ?? "";
  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";

  // 1. HMAC — reject anything not signed by Shopify before doing any work.
  if (!verifyOAuthHmac(params)) {
    return NextResponse.json({ error: "invalid_hmac" }, { status: 401 });
  }

  // 2. Shop + anti-CSRF state.
  if (!isValidShopDomain(shop) || !code) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const expectedState = req.cookies.get("shopify_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "invalid_state" }, { status: 401 });
  }

  // 3. Exchange code → offline access token.
  const { access_token } = await exchangeCodeForToken(shop, code);

  // 4. Persist (encrypted) + register webhooks.
  await upsertShopOnInstall(shop, access_token);
  await registerAppWebhooks(shop, access_token);

  // 5. Hand off to the embedded app inside the Shopify admin.
  const res = NextResponse.redirect(
    `https://${shop}/admin/apps/${shopifyConfig.apiKey}`,
  );
  res.cookies.delete("shopify_oauth_state");
  return res;
}
