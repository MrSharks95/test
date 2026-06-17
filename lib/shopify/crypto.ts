import "server-only";

import crypto from "node:crypto";

import { env } from "@/lib/env";

/**
 * Authenticated symmetric encryption for secrets at rest (Shopify access
 * tokens). AES-256-GCM with a random 96-bit IV per message; the auth tag
 * guarantees integrity. Key = APP_ENCRYPTION_KEY (32 bytes, base64).
 *
 * Stored format: `iv:tag:ciphertext`, each part hex-encoded.
 */
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function getKey(): Buffer {
  const key = Buffer.from(env.APP_ENCRYPTION_KEY, "base64");
  // Validated as 32 bytes at boot (lib/env.ts), guarded again here.
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const decipher = crypto.createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
