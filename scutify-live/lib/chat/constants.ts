/** Canal Realtime Broadcast privé (doit correspondre au SQL). */
export const CHAT_CHANNEL = "live-chat";

/** Messages chargés à l'ouverture. */
export const INITIAL_MESSAGES = 50;

/** Plafond de messages gardés dans le DOM. */
export const MAX_DOM_MESSAGES = 200;

export const MAX_MESSAGE_LENGTH = 300;
export const PSEUDO_MIN_LENGTH = 2;
export const PSEUDO_MAX_LENGTH = 20;

/** Anti-flood minimal appliqué côté serveur même sans slow mode. */
export const MIN_SEND_INTERVAL_SECONDS = 2;

export const SLOW_MODE_OPTIONS = [0, 5, 10, 30] as const;

/** "Jusqu'à la fin du live" = 12 h (un live ne dure jamais plus). */
export const END_OF_LIVE_MINUTES = 12 * 60;

export const MUTE_OPTIONS = [
  { minutes: 5, label: "5 minutes" },
  { minutes: 60, label: "1 heure" },
  { minutes: END_OF_LIVE_MINUTES, label: "Jusqu'à la fin du live" },
] as const;

export const PINNED_TEMPLATE = {
  message: "La formation Scutify est ouverte : places limitées pendant le live !",
  label: "🚀 Rejoindre la formation",
  url: "https://www.scutify-club.com/offers/ym7bNY2K/checkout",
} as const;

/** Colonnes lues côté client (le statut n'est pas exposé à l'affichage). */
export const MESSAGE_COLUMNS = "id,user_id,pseudo,content,is_team,created_at";
