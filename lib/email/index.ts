import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

/**
 * Resend client for the legal acknowledgement email (durable medium).
 *
 * Foundations only — the FR/EN template engine, idempotency and the
 * `email_sent` event are implemented in Prompt 5.
 */
let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(env.RESEND_API_KEY);
  return cached;
}

/** Default sender; a shop may override with its own verified `email_from`. */
export const DEFAULT_FROM = env.RESEND_FROM;
