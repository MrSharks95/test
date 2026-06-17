import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/shopify/crypto";

/**
 * Shop persistence and GDPR purge. Uses the service_role client (bypasses RLS),
 * so every query is explicitly scoped by shop. See .claude/rules/supabase-rls.md.
 */

export interface ShopRow {
  id: string;
  shop_domain: string;
  access_token: string | null;
  email_from: string | null;
  default_country: string;
  installed_at: string;
  uninstalled_at: string | null;
}

/**
 * Upsert a shop on install. Stores the access token ENCRYPTED and clears
 * `uninstalled_at` so a re-install cleanly reactivates without creating a
 * duplicate (unique on shop_domain).
 */
export async function upsertShopOnInstall(
  shopDomain: string,
  accessToken: string,
): Promise<ShopRow> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("shops")
    .upsert(
      {
        shop_domain: shopDomain,
        access_token: encrypt(accessToken),
        uninstalled_at: null,
      },
      { onConflict: "shop_domain" },
    )
    .select()
    .single();

  if (error) throw new Error(`upsertShopOnInstall failed: ${error.message}`);
  return data as ShopRow;
}

export async function getShopByDomain(
  shopDomain: string,
): Promise<ShopRow | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("shops")
    .select()
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  if (error) throw new Error(`getShopByDomain failed: ${error.message}`);
  return (data as ShopRow | null) ?? null;
}

/** Mark a shop uninstalled (app/uninstalled webhook). */
export async function markUninstalled(shopDomain: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("shops")
    .update({ uninstalled_at: new Date().toISOString() })
    .eq("shop_domain", shopDomain);

  if (error) throw new Error(`markUninstalled failed: ${error.message}`);
}

/**
 * customers/redact — delete every withdrawal of the given customer for this
 * shop. Cascades to withdrawal_events / withdrawal_notes via FK.
 */
export async function redactCustomer(
  shopDomain: string,
  customerEmail: string,
): Promise<void> {
  const shop = await getShopByDomain(shopDomain);
  if (!shop) return; // nothing stored for this shop

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("withdrawals")
    .delete()
    .eq("shop_id", shop.id)
    .eq("customer_email", customerEmail);

  if (error) throw new Error(`redactCustomer failed: ${error.message}`);
}

/**
 * shop/redact — purge ALL data for the shop. Deleting the shop row cascades to
 * withdrawals, events and notes (on delete cascade in migration 001).
 */
export async function redactShop(shopDomain: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("shops")
    .delete()
    .eq("shop_domain", shopDomain);

  if (error) throw new Error(`redactShop failed: ${error.message}`);
}
