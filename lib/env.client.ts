import { z } from "zod";

/**
 * Public environment — safe to expose to the browser.
 *
 * Next.js only inlines `NEXT_PUBLIC_*` variables into client bundles, so we
 * reference them by their full names explicitly (static analysis requirement).
 * Nothing secret belongs here; server-only values live in `lib/env.ts`.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

function loadClientEnv() {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid public environment variables:\n${issues}\n`,
    );
  }

  return parsed.data;
}

export const clientEnv = loadClientEnv();

export type ClientEnv = z.infer<typeof clientSchema>;
