import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { INITIAL_MESSAGES, MESSAGE_COLUMNS } from "@/lib/chat/constants";
import type { ChatSnapshot } from "@/lib/chat/types";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * État public du chat (réglages + 50 derniers messages visibles), mis en cache
 * ~1 s sur le CDN Vercel.
 *
 * Avec 4 000 spectateurs, une coupure Realtime provoque 4 000 resynchro-
 * nisations quasi simultanées : servies par le CDN, elles coûtent ~1 requête
 * Supabase toutes les 2 s au lieu de 8 000. Clé publique uniquement (RLS :
 * messages visibles et réglages, rien d'autre).
 */
export async function GET() {
  const supabase = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const generatedAt = new Date().toISOString();
  const [settings, messages] = await Promise.all([
    supabase
      .from("chat_settings")
      .select(
        "chat_enabled,slow_mode_seconds,links_allowed,pinned_message,pinned_url,pinned_label,custom_html,custom_html_updated_at,updated_at",
      )
      .eq("id", 1)
      .single(),
    supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(INITIAL_MESSAGES),
  ]);

  if (settings.error || messages.error) {
    console.error("[snapshot] lecture Supabase impossible", settings.error ?? messages.error);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const { custom_html: customHtml, ...publicSettings } = settings.data;
  const body: ChatSnapshot = {
    settings: publicSettings,
    custom_html: customHtml,
    messages: (messages.data ?? []).reverse(),
    generated_at: generatedAt,
  };

  return NextResponse.json(body, {
    headers: {
      // ≤ ~2 s d'ancienneté (le client se rattrape juste après l'abonnement).
      "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=1",
    },
  });
}
