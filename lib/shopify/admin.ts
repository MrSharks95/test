import "server-only";

import { SHOPIFY_API_VERSION } from "@/lib/shopify";

/**
 * Minimal Shopify Admin API GraphQL client. The caller passes the shop domain
 * and the (decrypted) offline access token. Used for webhook registration here
 * and order matching in Prompt 3.
 */
export async function adminGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!res.ok) {
    throw new Error(`Admin GraphQL request failed (${res.status})`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: unknown;
  };

  if (json.errors) {
    throw new Error(`Admin GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}
