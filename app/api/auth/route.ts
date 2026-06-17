import { NextResponse, type NextRequest } from "next/server";

import {
  buildAuthorizeUrl,
  generateState,
  isValidShopDomain,
} from "@/lib/shopify/oauth";

export const dynamic = "force-dynamic";

/**
 * OAuth step 1 — begin install.
 * `/api/auth?shop=xxx.myshopify.com` → set anti-CSRF state cookie → redirect to
 * the Shopify consent screen.
 */
export function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop")?.toLowerCase() ?? "";

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "invalid_shop" }, { status: 400 });
  }

  const state = generateState();
  const res = NextResponse.redirect(buildAuthorizeUrl(shop, state));

  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });

  return res;
}
