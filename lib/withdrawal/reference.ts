import crypto from "node:crypto";

/**
 * Withdrawal reference: `WR-` + 6 unambiguous alphanumerics (no O/0/I/1).
 * Pure function — uniqueness per shop is enforced at insert time (retry on
 * the (shop_id, reference) unique constraint).
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReference(): string {
  let out = "WR-";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}
