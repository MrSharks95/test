import "server-only";

import crypto from "node:crypto";

import { shopifyConfig } from "@/lib/shopify";

/**
 * Shopify OAuth (offline access token) — hand-rolled against the REST OAuth
 * endpoints. No SDK; native crypto + fetch only.
 */

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** Reject anything that is not a well-formed *.myshopify.com domain. */
export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN_RE.test(shop.toLowerCase());
}

/** Random anti-CSRF state (nonce) stored in a cookie and echoed by Shopify. */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function redirectUri(): string {
  return `${shopifyConfig.appUrl}/api/auth/callback`;
}

/** Build the consent screen URL the merchant is redirected to. */
export function buildAuthorizeUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: shopifyConfig.apiKey,
    scope: shopifyConfig.scopes.join(","),
    redirect_uri: redirectUri(),
    state,
    "grant_options[]": "", // offline (default) access token
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export interface AccessTokenResponse {
  access_token: string;
  scope: string;
}

/** Exchange the authorization code for a permanent offline access token. */
export async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<AccessTokenResponse> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: shopifyConfig.apiKey,
      client_secret: shopifyConfig.apiSecret,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status})`);
  }
  return (await res.json()) as AccessTokenResponse;
}
