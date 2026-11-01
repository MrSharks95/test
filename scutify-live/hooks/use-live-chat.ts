"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { CHAT_CHANNEL, INITIAL_MESSAGES, MESSAGE_COLUMNS, MIN_SEND_INTERVAL_SECONDS } from "@/lib/chat/constants";
import { parseChatError } from "@/lib/chat/errors";
import { initialMessagesState, messagesReducer } from "@/lib/chat/messages-reducer";
import { parseReactionCounts, type ReactionCounts } from "@/lib/chat/reactions";
import {
  type ChatMessage,
  type ChatSettings,
  type ChatSnapshot,
  type ConnectionState,
  isChatMessage,
  type Profile,
  type UserMutedEvent,
} from "@/lib/chat/types";
import { getSupabase } from "@/lib/supabase/client";

type Mode = "viewer" | "admin";

type Options = {
  /**
   * viewer : connexion anonyme automatique (nécessaire pour recevoir le canal
   *          privé), pseudo demandé seulement pour écrire.
   * admin  : la session équipe doit déjà exister (page /admin).
   */
  mode: Mode;
  onUserMuted?: (event: UserMutedEvent) => void;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

const BATCH_MS = 80;
const MAX_RETRY_DELAY_MS = 15_000;
/** Étale les resynchronisations de milliers de clients après une coupure. */
const RESYNC_JITTER_MS = 4_000;
/**
 * Rattrapage après chaque abonnement : l'instantané CDN peut dater de ~2 s et
 * les lots partent toutes les ~2 s. Relire l'instantané 2,5 s après
 * l'abonnement garantit qu'aucun message diffusé avant l'abonnement n'est raté.
 */
const CATCH_UP_DELAY_MS = 2_500;

type InitialData = {
  settings: ChatSettings;
  customHtml: string | null;
  messages: ChatMessage[];
  profile: Profile | null;
  /** Horodatage de l'instantané (ms), pour la réconciliation. */
  until?: number;
};

function backoff(attempt: number): number {
  return Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
}

export function useLiveChat({ mode, onUserMuted }: Options) {
  const supabase = getSupabase();

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [customHtml, setCustomHtml] = useState<string | null>(null);
  const customHtmlVersionRef = useRef<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [state, dispatch] = useReducer(messagesReducer, initialMessagesState);

  const userIdRef = useRef<string | null>(null);
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const onUserMutedRef = useRef(onUserMuted);
  useEffect(() => {
    onUserMutedRef.current = onUserMuted;
  });

  const isAdmin = profile?.role === "admin";

  // ------------------------------------------------------------ fetchers ---

  /** Fil public lu directement en base (admin, ou secours si le CDN échoue). */
  const fetchVisibleMessages = useCallback(async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(INITIAL_MESSAGES);
    if (error) throw error;
    return (data ?? []).reverse();
  }, [supabase]);

  /** Messages masqués (shadow) de l'utilisateur : lui seul les voit. */
  const fetchOwnShadow = useCallback(
    async (uid: string): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("status", "shadow")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(INITIAL_MESSAGES);
      if (error) throw error;
      return data ?? [];
    },
    [supabase],
  );

  const fetchSettings = useCallback(async (): Promise<{ settings: ChatSettings; customHtml: string | null }> => {
    const { data, error } = await supabase
      .from("chat_settings")
      .select(
        "chat_enabled,slow_mode_seconds,links_allowed,pinned_message,pinned_url,pinned_label,custom_html,custom_html_updated_at,quick_replies,quick_replies_until,reactions_enabled,updated_at",
      )
      .eq("id", 1)
      .single();
    if (error) throw error;
    const { custom_html, ...rest } = data;
    return { settings: rest, customHtml: custom_html };
  }, [supabase]);

  const fetchSnapshot = useCallback(
    (): Promise<ChatSnapshot | null> =>
      fetch("/api/chat/snapshot")
        .then((r) => (r.ok ? (r.json() as Promise<ChatSnapshot>) : null))
        .catch(() => null),
    [],
  );

  const fetchProfile = useCallback(
    async (uid: string): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,pseudo,email,role,muted_until,banned")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    [supabase],
  );

  /**
   * Charge réglages + messages + profil.
   * Viewer : réglages et fil public via /api/chat/snapshot (cache CDN 2 s),
   * puis seulement ce qui lui est propre (profil, messages shadow).
   * Admin  : lecture directe en base (données toujours fraîches).
   */
  const loadData = useCallback(
    async (uid: string, options: { knownWithoutProfile?: boolean } = {}): Promise<InitialData> => {
      let settings: ChatSettings;
      let customHtml: string | null;
      let messages: ChatMessage[];
      let until: number | undefined;

      const snapshot = mode === "viewer" ? await fetchSnapshot() : null;

      if (snapshot) {
        settings = snapshot.settings;
        customHtml = snapshot.custom_html ?? null;
        messages = snapshot.messages;
        until = Date.parse(snapshot.generated_at);
      } else {
        let fresh: { settings: ChatSettings; customHtml: string | null };
        [fresh, messages] = await Promise.all([fetchSettings(), fetchVisibleMessages()]);
        ({ settings, customHtml } = fresh);
      }

      // Un compte anonyme tout juste créé n'a pas encore de profil.
      const profile = options.knownWithoutProfile ? null : await fetchProfile(uid);
      if (mode === "viewer" && profile) {
        messages = [...messages, ...(await fetchOwnShadow(uid))];
      }
      return {
        settings,
        customHtml,
        messages,
        profile,
        ...(until !== undefined && Number.isFinite(until) ? { until } : {}),
      };
    },
    [mode, fetchSnapshot, fetchSettings, fetchVisibleMessages, fetchProfile, fetchOwnShadow],
  );

  // ------------------------------------------------------- initial load ---

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();

        let freshAnonymous = false;
        if (!session && mode === "viewer") {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          session = data.session;
          freshAnonymous = true;
        }
        if (!session) throw new Error("Session expirée, reconnecte-toi.");

        const uid = session.user.id;
        const initial = await loadData(uid, { knownWithoutProfile: freshAnonymous });
        if (cancelled) return;

        userIdRef.current = uid;
        setUserId(uid);
        setSettings(initial.settings);
        setCustomHtml(initial.customHtml);
        customHtmlVersionRef.current = initial.settings.custom_html_updated_at ?? null;
        setProfile(initial.profile);
        dispatch({ type: "replace", messages: initial.messages });
        setLoadError(null);
        setPhase("ready");
      } catch (error) {
        if (cancelled) return;
        console.error("[live-chat] chargement impossible", error);
        setLoadError("Impossible de rejoindre le chat. Nouvelle tentative…");
        setPhase((p) => (p === "ready" ? p : "error"));
        retryTimer = setTimeout(() => setAttempt((a) => a + 1), backoff(attempt));
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [supabase, mode, attempt, loadData]);

  // Session perdue (refresh token invalide, déconnexion dans un autre onglet…).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && userIdRef.current && session.user.id !== userIdRef.current)) {
        userIdRef.current = null;
        setProfile(null);
        setPhase("loading");
        setAttempt((a) => a + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  // ----------------------------------------------------------- realtime ---

  const queueRef = useRef<ChatMessage[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Abonnés aux totaux de réactions (animations, statistiques admin). */
  const reactionListenersRef = useRef(new Set<(counts: ReactionCounts) => void>());

  const enqueue = useCallback((message: ChatMessage) => {
    // Regroupe les messages reçus (≈ 80 ms) : un seul rendu par rafale.
    queueRef.current.push(message);
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const batch = queueRef.current;
      queueRef.current = [];
      if (batch.length > 0) dispatch({ type: "append", messages: batch });
    }, BATCH_MS);
  }, []);

  const resync = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      // Spectateur sans pseudo : pas de profil à relire (épargne la base).
      const fresh = await loadData(uid, { knownWithoutProfile: !profileRef.current });
      setSettings(fresh.settings);
      setCustomHtml(fresh.customHtml);
      customHtmlVersionRef.current = fresh.settings.custom_html_updated_at ?? null;
      setProfile(fresh.profile);
      dispatch({
        type: "reconcile",
        messages: fresh.messages,
        ...(fresh.until !== undefined ? { until: fresh.until } : {}),
      });
    } catch (error) {
      console.warn("[live-chat] resynchronisation impossible", error);
    }
  }, [loadData]);

  /**
   * Le bloc HTML n'est pas diffusé (poids × milliers de spectateurs) : on le
   * relit quand sa date de modification change. Spectateurs : via le CDN,
   * avec un délai aléatoire (le cache se rafraîchit en ~1-2 s).
   */
  const refreshCustomHtml = useCallback(() => {
    const run = async () => {
      if (mode === "viewer") {
        const snapshot = await fetchSnapshot();
        if (snapshot) setCustomHtml(snapshot.custom_html ?? null);
      } else {
        try {
          const { customHtml: fresh } = await fetchSettings();
          setCustomHtml(fresh);
        } catch (error) {
          console.warn("[live-chat] lecture du bloc impossible", error);
        }
      }
    };
    setTimeout(() => void run(), mode === "viewer" ? 2_500 + Math.random() * 3_000 : 0);
  }, [mode, fetchSnapshot, fetchSettings]);

  useEffect(() => {
    if (phase !== "ready" || !userId) return;

    let disposed = false;
    let current: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    let wasSubscribed = false;

    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    };

    const subscribe = async () => {
      // Transmet le JWT courant à Realtime (autorisation du canal privé).
      await supabase.realtime.setAuth();
      if (disposed) return;

      const channel = supabase.channel(CHAT_CHANNEL, { config: { private: true } });
      current = channel;

      channel
        // Les messages arrivent par lots ({ messages: [...], reactions? }) :
        // une seule diffusion toutes les ~3 s quel que soit le débit du chat,
        // totaux des réactions compris.
        .on("broadcast", { event: "new_message" }, ({ payload }) => {
          const data = payload as { messages?: unknown; reactions?: unknown } | undefined;
          const batch = data?.messages;
          if (Array.isArray(batch)) {
            for (const message of batch) if (isChatMessage(message)) enqueue(message);
          } else if (isChatMessage(payload)) {
            enqueue(payload);
          }
          const reactions = parseReactionCounts(data?.reactions);
          if (reactions) for (const listener of reactionListenersRef.current) listener(reactions);
        })
        .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
          const data = (payload ?? {}) as { all?: boolean; ids?: unknown };
          if (data.all) {
            queueRef.current = [];
            dispatch({ type: "clear" });
            return;
          }
          if (Array.isArray(data.ids)) {
            const ids = data.ids.filter((id): id is string => typeof id === "string");
            const idSet = new Set(ids);
            queueRef.current = queueRef.current.filter((m) => !idSet.has(m.id));
            dispatch({ type: "remove", ids });
          }
        })
        .on("broadcast", { event: "settings_updated" }, ({ payload }) => {
          if (payload && typeof payload === "object") {
            const next = payload as ChatSettings;
            setSettings((prev) => ({ ...(prev ?? ({} as ChatSettings)), ...next }));
            const version = next.custom_html_updated_at ?? null;
            if (version !== customHtmlVersionRef.current) {
              customHtmlVersionRef.current = version;
              refreshCustomHtml();
            }
          }
        })
        .on("broadcast", { event: "user_muted" }, ({ payload }) => {
          const event = payload as UserMutedEvent;
          if (!event || typeof event.user_id !== "string") return;
          if (event.user_id === userIdRef.current) {
            setProfile((p) => (p ? { ...p, muted_until: event.muted_until, banned: event.banned } : p));
          }
          onUserMutedRef.current?.(event);
        })
        .subscribe((status, error) => {
          if (disposed || current !== channel) return;
          if (status === "SUBSCRIBED") {
            clearRetry();
            retries = 0;
            setConnection("online");
            // Rattrape ce qui a pu être diffusé avant l'abonnement (1re connexion)
            // ou pendant une coupure. Délai aléatoire côté spectateurs pour ne
            // pas resynchroniser 4 000 clients au même instant.
            const delay =
              mode === "viewer"
                ? CATCH_UP_DELAY_MS + Math.random() * (wasSubscribed ? RESYNC_JITTER_MS : 1_500)
                : 300;
            setTimeout(() => {
              if (!disposed) void resync();
            }, delay);
            wasSubscribed = true;
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (error) console.warn(`[live-chat] canal ${status}`, error);
            setConnection("reconnecting");
            scheduleResubscribe();
          }
        });
    };

    // Recrée le canal avec un backoff exponentiel. Si realtime-js rétablit le
    // canal de lui-même avant l'échéance, SUBSCRIBED annule ce timer.
    const scheduleResubscribe = (delay = backoff(retries)) => {
      if (disposed || retryTimer) return;
      retries += 1;
      retryTimer = setTimeout(async () => {
        retryTimer = null;
        const stale = current;
        current = null;
        if (stale) await supabase.removeChannel(stale);
        if (!disposed) void subscribe();
      }, delay);
    };

    const onOffline = () => setConnection("reconnecting");
    const onOnline = () => {
      clearRetry();
      scheduleResubscribe(250);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const healthy = current?.state === "joined" && supabase.realtime.isConnected();
      if (!healthy) {
        clearRetry();
        scheduleResubscribe(0);
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    void subscribe();

    return () => {
      disposed = true;
      clearRetry();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if (current) void supabase.removeChannel(current);
      current = null;
    };
  }, [phase, userId, supabase, mode, enqueue, resync, refreshCustomHtml]);

  useEffect(
    () => () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    },
    [],
  );

  // ------------------------------------------------------------ actions ---

  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const resume = useCallback(() => dispatch({ type: "resume" }), []);
  const removeMessages = useCallback((ids: string[]) => dispatch({ type: "remove", ids }), []);

  const joinChat = useCallback(
    async (pseudo: string): Promise<ActionResult> => {
      const { data, error } = await supabase.rpc("set_profile", { pseudo });
      if (error) return { ok: false, error: parseChatError(error).message };
      setProfile(data as unknown as Profile);
      return { ok: true };
    },
    [supabase],
  );

  const slowModeSeconds = settings?.slow_mode_seconds ?? 0;

  const sendMessage = useCallback(
    async (content: string): Promise<ActionResult> => {
      const { data, error } = await supabase.rpc("send_message", { content });
      if (error) {
        const parsed = parseChatError(error);
        if (parsed.kind === "slow_mode" && parsed.retryAfter) {
          setNextAllowedAt(Date.now() + parsed.retryAfter * 1000);
        } else if (parsed.kind === "muted" || parsed.kind === "chat_closed" || parsed.kind === "no_profile") {
          void resync();
        }
        return { ok: false, error: parsed.message };
      }

      if (isChatMessage(data)) {
        // Visible : l'écho Broadcast sera dédoublonné par id.
        // Shadow  : jamais diffusé, seul l'auteur l'ajoute à son fil.
        dispatch({ type: "resume" });
        dispatch({ type: "append", messages: [data] });
      }
      if (!isAdmin) {
        setNextAllowedAt(Date.now() + Math.max(slowModeSeconds, MIN_SEND_INTERVAL_SECONDS) * 1000);
      }
      return { ok: true };
    },
    [supabase, isAdmin, slowModeSeconds, resync],
  );

  /** S'abonne aux totaux de réactions reçus ; renvoie la désinscription. */
  const onReactions = useCallback((listener: (counts: ReactionCounts) => void) => {
    const listeners = reactionListenersRef.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  /** true si les réactions ont été comptées (sinon ignorées sans erreur). */
  const sendReactions = useCallback(
    async (counts: ReactionCounts): Promise<boolean> => {
      const { data, error } = await supabase.rpc("send_reactions", counts);
      if (error) {
        console.warn("[live-chat] réactions non envoyées", error.message);
        return false;
      }
      return data === true;
    },
    [supabase],
  );

  return useMemo(
    () => ({
      phase,
      loadError,
      connection,
      userId,
      profile,
      settings,
      setSettings,
      customHtml,
      setCustomHtml,
      isAdmin,
      messages: state.messages,
      pendingCount: state.pending.length,
      paused: state.paused,
      nextAllowedAt,
      pause,
      resume,
      removeMessages,
      joinChat,
      sendMessage,
      resync,
      onReactions,
      sendReactions,
    }),
    [
      phase,
      loadError,
      connection,
      userId,
      profile,
      settings,
      customHtml,
      isAdmin,
      state,
      nextAllowedAt,
      pause,
      resume,
      removeMessages,
      joinChat,
      sendMessage,
      resync,
      onReactions,
      sendReactions,
    ],
  );
}

export type LiveChat = ReturnType<typeof useLiveChat>;
