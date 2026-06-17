import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import { generateReference } from "@/lib/withdrawal/reference";
import type { WithdrawalItem } from "@/lib/withdrawal/types";

/**
 * Withdrawal persistence. service_role client (bypasses RLS) — every write is
 * explicitly scoped by shop_id. See .claude/rules/supabase-rls.md.
 */

export interface CreateWithdrawalInput {
  shopId: string;
  customerName: string | null;
  customerEmail: string;
  orderNumber: string;
  shopifyOrderId: number | null;
  orderVerified: boolean;
  customerCountry: string | null;
  items: WithdrawalItem[];
  reason: string | null;
  shippedAt: string | null;
  deadlineAt: string | null;
  deadlineStatus: string;
  refundDeadlineAt: string | null;
}

export interface CreatedWithdrawal {
  id: string;
  reference: string;
}

const UNIQUE_VIOLATION = "23505";
const MAX_REFERENCE_RETRIES = 5;

/**
 * Insert a withdrawal with a shop-unique reference (retry on collision), then
 * record the timeline events (`created`, plus `order_verified` when matched).
 *
 * NOTE: deadline computation (Prompt 4) and the acknowledgement email
 * (Prompt 5) hook in here at the call site once those modules exist.
 */
export async function createWithdrawal(
  input: CreateWithdrawalInput,
): Promise<CreatedWithdrawal> {
  const supabase = getServiceClient();

  for (let attempt = 0; attempt < MAX_REFERENCE_RETRIES; attempt++) {
    const reference = generateReference();
    const { data, error } = await supabase
      .from("withdrawals")
      .insert({
        shop_id: input.shopId,
        reference,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        order_number: input.orderNumber,
        shopify_order_id: input.shopifyOrderId,
        order_verified: input.orderVerified,
        customer_country: input.customerCountry,
        items: input.items,
        reason: input.reason,
        shipped_at: input.shippedAt,
        deadline_at: input.deadlineAt,
        deadline_status: input.deadlineStatus,
        refund_deadline_at: input.refundDeadlineAt,
      })
      .select("id, reference")
      .single();

    if (!error && data) {
      await recordCreationEvents(data.id, input.orderVerified);
      return data as CreatedWithdrawal;
    }

    if (error?.code === UNIQUE_VIOLATION) continue; // reference collision, retry
    throw new Error(`createWithdrawal failed: ${error?.message ?? "unknown"}`);
  }

  throw new Error("createWithdrawal failed: could not allocate a unique reference");
}

async function recordCreationEvents(
  withdrawalId: string,
  orderVerified: boolean,
): Promise<void> {
  const supabase = getServiceClient();
  const events = [
    { withdrawal_id: withdrawalId, type: "created", actor: "client" },
    ...(orderVerified
      ? [{ withdrawal_id: withdrawalId, type: "order_verified", actor: "system" }]
      : []),
  ];
  const { error } = await supabase.from("withdrawal_events").insert(events);
  if (error) throw new Error(`recordCreationEvents failed: ${error.message}`);
}
