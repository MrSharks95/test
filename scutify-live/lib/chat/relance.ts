import type { ChatSettings } from "./types";

/** Boutons de réponse rapide actifs à l'instant `nowMs` (sinon liste vide). */
export function activeQuickReplies(
  settings: Pick<ChatSettings, "quick_replies" | "quick_replies_until"> | null | undefined,
  nowMs: number,
): string[] {
  const replies = settings?.quick_replies;
  const until = settings?.quick_replies_until ? Date.parse(settings.quick_replies_until) : Number.NaN;
  if (!replies || replies.length === 0 || !Number.isFinite(until) || until <= nowMs) return [];
  return replies.filter((r) => typeof r === "string" && r.trim().length > 0).slice(0, 4);
}
