import "server-only";

import { z } from "zod";

/**
 * Server-side environment. Validated once at module load so the app fails
 * fast and loudly when a required key is missing or malformed.
 *
 * This module imports `server-only`: importing it from a Client Component
 * is a build error, which guarantees the service_role key never ships to
 * the browser. Public values live in `lib/env.client.ts` instead.
 */
const serverSchema = z.object({
  // --- Shopify ---
  SHOPIFY_API_KEY: z.string().min(1, "SHOPIFY_API_KEY is required"),
  SHOPIFY_API_SECRET: z.string().min(1, "SHOPIFY_API_SECRET is required"),
  SHOPIFY_SCOPES: z.string().min(1, "SHOPIFY_SCOPES is required"),
  SHOPIFY_APP_URL: z.string().url("SHOPIFY_APP_URL must be a valid URL"),

  // --- Supabase (server, service_role — bypasses RLS, never expose) ---
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // --- Resend ---
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM: z.string().min(1, "RESEND_FROM is required"),

  // --- App crypto: 32 bytes, base64 (openssl rand -base64 32) ---
  APP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => {
      try {
        return Buffer.from(v, "base64").length === 32;
      } catch {
        return false;
      }
    }, "APP_ENCRYPTION_KEY must be 32 bytes, base64 (run: openssl rand -base64 32)"),
});

function loadServerEnv() {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid server environment variables:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill in the missing values.\n`,
    );
  }

  return parsed.data;
}

export const env = loadServerEnv();

export type ServerEnv = z.infer<typeof serverSchema>;
