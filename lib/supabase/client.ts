import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env.client";

/**
 * Public Supabase client using the anon key. Safe to use in the browser.
 *
 * RLS is enforced for this key: by default every table denies access except
 * `withdrawal_rules` (public read). Never use this client to read or write
 * shop-scoped data — that goes through the server client. See
 * .claude/rules/supabase-rls.md.
 */
let cached: SupabaseClient | null = null;

export function getAnonClient(): SupabaseClient {
  if (cached) return cached;

  cached = createClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  return cached;
}
