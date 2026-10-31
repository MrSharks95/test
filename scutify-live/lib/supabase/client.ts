"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";

import type { Database } from "./types";

export type TypedSupabaseClient = SupabaseClient<Database>;

let browserClient: TypedSupabaseClient | null = null;

/**
 * Client navigateur unique (clé publique anon/publishable, soumise à RLS).
 * La session (anonyme ou équipe) est persistée dans le localStorage : un
 * rechargement ne redemande ni pseudo ni connexion.
 */
export function getSupabase(): TypedSupabaseClient {
  if (!browserClient) {
    browserClient = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "scutify-live-auth",
      },
    });
  }
  return browserClient;
}
