/** Erreur PostgREST / Supabase (forme minimale). */
type SupabaseLikeError = {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
};

export type ChatErrorKind =
  | "not_authenticated"
  | "no_profile"
  | "chat_closed"
  | "muted"
  | "slow_mode"
  | "empty"
  | "too_long"
  | "links"
  | "invalid_pseudo"
  | "reserved_pseudo"
  | "invalid_email"
  | "forbidden"
  | "target_admin"
  | "ip_rate_limit"
  | "duplicate"
  | "network"
  | "unknown";

export type ChatError = {
  kind: ChatErrorKind;
  message: string;
  /** Secondes à attendre (slow mode). */
  retryAfter?: number;
};

const KNOWN_HINTS = new Set<ChatErrorKind>([
  "not_authenticated",
  "no_profile",
  "chat_closed",
  "muted",
  "slow_mode",
  "empty",
  "too_long",
  "links",
  "invalid_pseudo",
  "reserved_pseudo",
  "invalid_email",
  "forbidden",
  "target_admin",
  "ip_rate_limit",
]);

/**
 * Les fonctions SQL lèvent des erreurs dont le message est déjà rédigé en
 * français et dont le `hint` porte un code machine. On les affiche telles
 * quelles ; tout le reste reçoit un message générique.
 */
export function parseChatError(error: unknown): ChatError {
  const e = (error ?? {}) as SupabaseLikeError;
  const hint = (e.hint ?? "") as ChatErrorKind;

  if (KNOWN_HINTS.has(hint) && e.message) {
    const retry = hint === "slow_mode" ? Number.parseInt(e.details ?? "", 10) : Number.NaN;
    return {
      kind: hint,
      message: e.message,
      ...(Number.isFinite(retry) && retry > 0 ? { retryAfter: retry } : {}),
    };
  }

  if (e.code === "23505") return { kind: "duplicate", message: "Cet élément existe déjà." };
  if (e.code === "42501") return { kind: "forbidden", message: "Action non autorisée." };

  const message = e.message ?? "";
  if (/fetch|network|Failed to|Load failed|NetworkError/i.test(message)) {
    return { kind: "network", message: "Connexion perdue. Réessaie dans un instant." };
  }

  return { kind: "unknown", message: "Une erreur est survenue. Réessaie." };
}
