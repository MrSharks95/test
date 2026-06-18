import "server-only";

import crypto from "node:crypto";

import { env } from "@/lib/env";

/**
 * Verify a Shopify App Bridge session token (JWT, HS256 signed with the app
 * secret). Returns the shop domain on success, or null. Used to authenticate
 * embedded admin API calls so a merchant only ever sees their own shop's data.
 */

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const LEEWAY_SECONDS = 10;

interface SessionTokenPayload {
  dest?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function verifySessionToken(token: string): { shop: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  const expected = crypto
    .createHmac("sha256", env.SHOPIFY_API_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (!timingSafeEqualStr(signature, expected)) return null;

  let claims: SessionTokenPayload;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now - LEEWAY_SECONDS) return null;
  if (typeof claims.nbf === "number" && claims.nbf > now + LEEWAY_SECONDS) return null;
  if (claims.aud !== env.SHOPIFY_API_KEY) return null;

  if (typeof claims.dest !== "string") return null;
  const shop = claims.dest
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!SHOP_RE.test(shop)) return null;

  return { shop };
}
