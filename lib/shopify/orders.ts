import "server-only";

import { adminGraphql } from "@/lib/shopify/admin";
import type { WithdrawalItem } from "@/lib/withdrawal/types";

/**
 * Order verification for step 1 of the withdrawal form.
 *
 * Looks up the order by name and confirms the customer email matches (strict).
 * On no match (wrong email, or order older than the read_orders 60-day window)
 * we return `verified: false` and the caller falls back to manual entry.
 */

export interface VerifiedOrder {
  verified: boolean;
  shopifyOrderId: number | null;
  country: string | null;
  shippedAt: string | null;
  items: WithdrawalItem[];
}

const ORDER_QUERY = /* GraphQL */ `
  query matchOrder($q: String!) {
    orders(first: 5, query: $q) {
      edges {
        node {
          id
          name
          email
          createdAt
          shippingAddress { countryCodeV2 }
          customer { email defaultAddress { countryCodeV2 } }
          fulfillments(first: 10) { createdAt }
          lineItems(first: 100) {
            edges { node { id title quantity } }
          }
        }
      }
    }
  }
`;

interface OrderNode {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  shippingAddress: { countryCodeV2: string | null } | null;
  customer: {
    email: string | null;
    defaultAddress: { countryCodeV2: string | null } | null;
  } | null;
  fulfillments: { createdAt: string }[];
  lineItems: { edges: { node: { id: string; title: string; quantity: number } }[] };
}

interface OrderQueryResult {
  orders: { edges: { node: OrderNode }[] };
}

/** Parse a Shopify GID (gid://shopify/Order/123) into its numeric id. */
function gidToNumber(gid: string): number | null {
  const last = gid.split("/").pop();
  const n = last ? Number(last) : NaN;
  return Number.isFinite(n) ? n : null;
}

function earliest(dates: string[]): string | null {
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a <= b ? a : b));
}

const EMPTY: VerifiedOrder = {
  verified: false,
  shopifyOrderId: null,
  country: null,
  shippedAt: null,
  items: [],
};

export async function verifyOrder(
  shop: string,
  accessToken: string,
  orderNumber: string,
  email: string,
): Promise<VerifiedOrder> {
  const name = `#${orderNumber.trim().replace(/^#/, "")}`;
  const wantedEmail = email.trim().toLowerCase();

  let data: OrderQueryResult;
  try {
    data = await adminGraphql<OrderQueryResult>(shop, accessToken, ORDER_QUERY, {
      q: `name:${name}`,
    });
  } catch {
    // Network/permission/old-order failure → fall back to manual entry.
    return EMPTY;
  }

  const match = data.orders.edges.find(
    ({ node }) => (node.email ?? node.customer?.email ?? "").toLowerCase() === wantedEmail,
  );
  if (!match) return EMPTY;

  const node = match.node;
  return {
    verified: true,
    shopifyOrderId: gidToNumber(node.id),
    country:
      node.shippingAddress?.countryCodeV2 ??
      node.customer?.defaultAddress?.countryCodeV2 ??
      null,
    shippedAt: earliest(node.fulfillments.map((f) => f.createdAt)),
    items: node.lineItems.edges.map(({ node: li }) => ({
      title: li.title,
      quantity: li.quantity,
      lineItemId: li.id,
    })),
  };
}
