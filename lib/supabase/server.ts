import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Server-side Supabase client using the service_role key.
 *
 * ⚠️ This client BYPASSES Row Level Security. It must only ever run on the
 * server. The `server-only` import above makes importing this file from a
 * Client Component a build error. All shop-scoped isolation is the caller's
 * responsibility (always filter by shop_id). See .claude/rules/supabase-rls.md.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
