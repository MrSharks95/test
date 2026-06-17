import "server-only";

import { shopifyConfig } from "@/lib/shopify";
import { adminGraphql } from "@/lib/shopify/admin";

/**
 * Webhook topics we subscribe to via the Admin API after install.
 *
 * Note: the three GDPR/compliance topics (customers/data_request,
 * customers/redact, shop/redact) are configured at the app level in the Partner
 * Dashboard and delivered to the same /api/webhooks endpoint; APP_UNINSTALLED
 * is registered per-shop here so re-installs stay consistent.
 */
export const APP_WEBHOOK_TOPICS = ["APP_UNINSTALLED"] as const;

const REGISTER_MUTATION = /* GraphQL */ `
  mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
      userErrors { field message }
      webhookSubscription { id }
    }
  }
`;

interface RegisterResult {
  webhookSubscriptionCreate: {
    userErrors: { field: string[]; message: string }[];
    webhookSubscription: { id: string } | null;
  };
}

/** Register (idempotently) the app webhooks for a freshly installed shop. */
export async function registerAppWebhooks(
  shop: string,
  accessToken: string,
): Promise<void> {
  const callbackUrl = `${shopifyConfig.appUrl}/api/webhooks`;

  for (const topic of APP_WEBHOOK_TOPICS) {
    const data = await adminGraphql<RegisterResult>(
      shop,
      accessToken,
      REGISTER_MUTATION,
      { topic, sub: { callbackUrl, format: "JSON" } },
    );

    const errors = data.webhookSubscriptionCreate.userErrors;
    // "already exists" style errors are safe to ignore on re-install.
    const fatal = errors.filter(
      (e) => !/already|taken|exist/i.test(e.message),
    );
    if (fatal.length > 0) {
      throw new Error(
        `Webhook registration failed for ${topic}: ${JSON.stringify(fatal)}`,
      );
    }
  }
}
