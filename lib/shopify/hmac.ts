import "server-only";

import crypto from "node:crypto";

import { env } from "@/lib/env";

/**
 * Constant-time comparison of two hex/base64 strings of equal byte length.
 * Returns false instead of throwing on length mismatch.
 */
function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * OAuth callback HMAC.
 *
 * Shopify signs the callback query string: take all params except `hmac` (and
 * `signature`), sort by key, join as `key=value` with `&`, HMAC-SHA256 with the
 * API secret, hex-encoded. Compare in constant time. See
 * .claude/rules/shopify-app-proxy.md for the distinction with the proxy format.
 */
export function verifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const provided = searchParams.get("hmac");
  if (!provided) return false;

  const pairs: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "hmac" || key === "signature") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const message = pairs.join("&");

  const digest = crypto
    .createHmac("sha256", env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  return safeEqual(Buffer.from(digest, "hex"), Buffer.from(provided, "hex"));
}

/**
 * App Proxy signature.
 *
 * Distinct from OAuth/webhooks: take every query param except `signature`,
 * sort by key, join as `key=value` with NO separator (multi-valued keys are
 * comma-joined), HMAC-SHA256 with the API secret, hex-encoded. Constant-time
 * compare to the `signature` param. See .claude/rules/shopify-app-proxy.md.
 */
export function verifyProxySignature(searchParams: URLSearchParams): boolean {
  const provided = searchParams.get("signature");
  if (!provided) return false;

  const grouped = new Map<string, string[]>();
  for (const [key, value] of searchParams.entries()) {
    if (key === "signature") continue;
    const arr = grouped.get(key) ?? [];
    arr.push(value);
    grouped.set(key, arr);
  }

  const message = [...grouped.keys()]
    .sort()
    .map((key) => `${key}=${grouped.get(key)!.join(",")}`)
    .join("");

  const digest = crypto
    .createHmac("sha256", env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  return safeEqual(Buffer.from(digest, "hex"), Buffer.from(provided, "hex"));
}

/**
 * Webhook HMAC.
 *
 * Distinct mechanism: HMAC-SHA256 over the RAW request body, base64-encoded,
 * sent in the `X-Shopify-Hmac-Sha256` header. Never parse the body before this
 * check passes.
 */
export function verifyWebhookHmac(rawBody: string, header: string | null): boolean {
  if (!header) return false;

  const digest = crypto
    .createHmac("sha256", env.SHOPIFY_API_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  return safeEqual(Buffer.from(digest, "base64"), Buffer.from(header, "base64"));
}
