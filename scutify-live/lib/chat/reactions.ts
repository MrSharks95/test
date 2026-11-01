/**
 * Réactions du live (🔥 💰 ❤️ 👍) : logique pure, sans dépendance UI.
 *
 * Les appuis sont regroupés côté navigateur (un appel toutes les ~2 s) puis
 * additionnés en base et diffusés en totaux avec le lot de messages (~3 s).
 */

export type ReactionKind = "fire" | "money" | "heart" | "thumbs";
export type ReactionCounts = Record<ReactionKind, number>;

export const REACTIONS: readonly { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "fire", emoji: "🔥", label: "Envoyer une flamme" },
  { kind: "money", emoji: "💰", label: "Envoyer de l'argent" },
  { kind: "heart", emoji: "❤️", label: "Envoyer un cœur" },
  { kind: "thumbs", emoji: "👍", label: "Envoyer un pouce levé" },
];

export const REACTION_KINDS: readonly ReactionKind[] = REACTIONS.map((r) => r.kind);

/** Doit correspondre au plafond par type et par appel de send_reactions(). */
export const MAX_REACTIONS_PER_CALL = 30;

/** Un appel au plus toutes les 2 s (limite serveur : 8 appels / 10 s). */
export const REACTION_SEND_INTERVAL_MS = 2_000;

export function emptyCounts(): ReactionCounts {
  return { fire: 0, money: 0, heart: 0, thumbs: 0 };
}

export function totalOf(counts: ReactionCounts): number {
  return counts.fire + counts.money + counts.heart + counts.thumbs;
}

export function addCounts(a: ReactionCounts, b: ReactionCounts): ReactionCounts {
  return { fire: a.fire + b.fire, money: a.money + b.money, heart: a.heart + b.heart, thumbs: a.thumbs + b.thumbs };
}

/** Totaux reçus dans un lot ; null si absents, invalides ou tous nuls. */
export function parseReactionCounts(value: unknown): ReactionCounts | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const counts = emptyCounts();
  for (const kind of REACTION_KINDS) {
    const n = source[kind];
    if (n === undefined) continue;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
    counts[kind] = Math.floor(n);
  }
  return totalOf(counts) > 0 ? counts : null;
}

/**
 * Prend au plus `max` appuis par type pour un appel ; le reste attend le
 * suivant.
 */
export function takeBatch(
  pending: ReactionCounts,
  max = MAX_REACTIONS_PER_CALL,
): { batch: ReactionCounts; rest: ReactionCounts } {
  const batch = emptyCounts();
  const rest = emptyCounts();
  for (const kind of REACTION_KINDS) {
    batch[kind] = Math.min(pending[kind], max);
    rest[kind] = pending[kind] - batch[kind];
  }
  return { batch, rest };
}

/**
 * Retire des totaux reçus les réactions de l'utilisateur lui-même (déjà
 * animées au moment de l'appui). Ce qui n'a pas encore été retrouvé dans un
 * lot reste à déduire du suivant.
 */
export function subtractOwn(
  received: ReactionCounts,
  own: ReactionCounts,
): { others: ReactionCounts; remainingOwn: ReactionCounts } {
  const others = emptyCounts();
  const remainingOwn = emptyCounts();
  for (const kind of REACTION_KINDS) {
    others[kind] = Math.max(0, received[kind] - own[kind]);
    remainingOwn[kind] = Math.max(0, own[kind] - received[kind]);
  }
  return { others, remainingOwn };
}

/**
 * Nombre d'émojis à faire monter pour `count` réactions d'un même type :
 * 1 pour 1 jusqu'à 8, puis progression logarithmique, plafonnée (fluidité
 * sur mobile, même quand 4 000 personnes réagissent en même temps).
 */
export function particlesFor(count: number, max = 16): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const n = Math.floor(count);
  if (n <= 8) return Math.min(n, max);
  return Math.min(max, Math.round(8 + 3 * Math.log2(n / 8)));
}

/** Totaux glissants (ex. dernière minute) pour l'écran admin. */
export function sumSince(entries: readonly { at: number; counts: ReactionCounts }[], since: number): ReactionCounts {
  let sum = emptyCounts();
  for (const entry of entries) if (entry.at >= since) sum = addCounts(sum, entry.counts);
  return sum;
}
