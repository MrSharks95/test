import "server-only";

import { DEFAULT_FROM, getResend } from "@/lib/email";
import {
  buildItemsHtml,
  escapeHtml,
  formatDate,
  interpolate,
  localeForCountry,
} from "@/lib/email/render";
import { pickTemplate, type StoredTemplate } from "@/lib/email/templates";
import { getServiceClient } from "@/lib/supabase/server";
import type { WithdrawalItem } from "@/lib/withdrawal/types";

/**
 * Send the legal acknowledgement email for a withdrawal.
 *
 * - Idempotent: skips if an `email_sent` event already exists for this
 *   withdrawal (no double send on re-submission).
 * - Resilient: light retry; on final failure writes an `email_error` event and
 *   returns normally — email problems never block withdrawal creation.
 */
export async function sendAcknowledgement(withdrawalId: string): Promise<void> {
  const supabase = getServiceClient();

  // 1. Idempotency guard via the timeline.
  const { data: already } = await supabase
    .from("withdrawal_events")
    .select("id")
    .eq("withdrawal_id", withdrawalId)
    .eq("type", "email_sent")
    .limit(1);
  if (already && already.length > 0) return;

  // 2. Load the withdrawal and its shop (sender + template override).
  const { data: w } = await supabase
    .from("withdrawals")
    .select(
      "id, shop_id, reference, customer_name, customer_email, customer_country, items, refund_deadline_at, created_at",
    )
    .eq("id", withdrawalId)
    .maybeSingle();
  if (!w) return;

  const { data: shop } = await supabase
    .from("shops")
    .select("email_from, email_template, default_country")
    .eq("id", w.shop_id)
    .maybeSingle();

  const locale = localeForCountry(
    (w.customer_country as string | null) ?? (shop?.default_country as string | null) ?? null,
  );
  const template = pickTemplate(
    (shop?.email_template as StoredTemplate | null) ?? null,
    locale,
  );

  const items = (w.items as WithdrawalItem[] | null) ?? [];
  const refund = w.refund_deadline_at
    ? formatDate(new Date(w.refund_deadline_at as string), locale)
    : "—";

  const vars: Record<string, string> = {
    customer_name: escapeHtml(
      (w.customer_name as string | null)?.trim() ||
        (locale === "fr" ? "cher client" : "valued customer"),
    ),
    reference: escapeHtml(w.reference as string),
    date: formatDate(new Date(w.created_at as string), locale),
    items: buildItemsHtml(items, locale),
    refund_deadline: escapeHtml(refund),
  };

  const subject = interpolate(template.subject, vars);
  const html = interpolate(template.body, vars);
  const from = (shop?.email_from as string | null) || DEFAULT_FROM;

  // 3. Send with a light retry, then record the outcome as an event.
  try {
    await sendWithRetry({
      from,
      to: w.customer_email as string,
      subject,
      html,
    });
    await supabase.from("withdrawal_events").insert({
      withdrawal_id: withdrawalId,
      type: "email_sent",
      actor: "system",
    });
  } catch (err) {
    await supabase.from("withdrawal_events").insert({
      withdrawal_id: withdrawalId,
      type: "email_error",
      actor: "system",
      note: err instanceof Error ? err.message.slice(0, 500) : "unknown error",
    });
  }
}

interface SendArgs {
  from: string;
  to: string;
  subject: string;
  html: string;
}

const MAX_ATTEMPTS = 3;

async function sendWithRetry(args: SendArgs): Promise<void> {
  const resend = getResend();
  let lastError = "send failed";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { error } = await resend.emails.send(args);
    if (!error) return;
    lastError = error.message ?? "resend error";
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  throw new Error(lastError);
}
