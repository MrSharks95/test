import "server-only";

import { env } from "@/lib/env";

/**
 * Shopify integration surface.
 *
 * Foundations only — OAuth install, webhook registration and Admin API
 * GraphQL calls land in Prompt 2 / Prompt 3. The HMAC verification helpers
 * for the App Proxy and webhooks are mandatory and documented in
 * .claude/rules/shopify-app-proxy.md.
 */
export const SHOPIFY_API_VERSION = "2024-07" as const;

export const shopifyConfig = {
  apiKey: env.SHOPIFY_API_KEY,
  apiSecret: env.SHOPIFY_API_SECRET,
  scopes: env.SHOPIFY_SCOPES.split(",").map((s) => s.trim()),
  appUrl: env.SHOPIFY_APP_URL,
  apiVersion: SHOPIFY_API_VERSION,
} as const;
