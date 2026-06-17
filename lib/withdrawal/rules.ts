import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import { createRuleSet, type RuleResolver } from "@/lib/withdrawal/deadline";
import type { WithdrawalRule } from "@/lib/withdrawal/types";

/**
 * Load the seeded withdrawal_rules into an in-memory RuleResolver for
 * computeDeadline. The table is small (country × category), so a full read is
 * fine. `withdrawal_rules` is public reference data (read-only).
 */
export async function loadRuleSet(defaultCountry: string): Promise<RuleResolver> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("withdrawal_rules")
    .select("country_code, product_category, cooling_off_days, is_exempt, legal_ref");

  if (error) throw new Error(`loadRuleSet failed: ${error.message}`);

  const rules: WithdrawalRule[] = (data ?? []).map((r) => ({
    countryCode: r.country_code as string,
    productCategory: r.product_category as string,
    coolingOffDays: r.cooling_off_days as number,
    isExempt: r.is_exempt as boolean,
    legalRef: (r.legal_ref as string | null) ?? null,
  }));

  return createRuleSet(rules, defaultCountry);
}
