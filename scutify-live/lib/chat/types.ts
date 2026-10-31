/** Message tel que diffusé / affiché (jamais le statut ni l'email). */
export type ChatMessage = {
  id: string;
  user_id: string;
  pseudo: string;
  content: string;
  is_team: boolean;
  created_at: string;
};

export type ChatSettings = {
  chat_enabled: boolean;
  slow_mode_seconds: number;
  links_allowed: boolean;
  pinned_message: string | null;
  pinned_url: string | null;
  pinned_label: string | null;
  updated_at?: string;
};

export type Profile = {
  id: string;
  pseudo: string;
  email: string;
  role: "viewer" | "admin";
  muted_until: string | null;
  banned: boolean;
};

export type UserMutedEvent = {
  user_id: string;
  muted_until: string | null;
  banned: boolean;
};

export type ConnectionState = "connecting" | "online" | "reconnecting";

/** Instantané public servi (et mis en cache) par /api/chat/snapshot. */
export type ChatSnapshot = {
  settings: ChatSettings;
  messages: ChatMessage[];
  /** Horodatage serveur (ISO) de génération de l'instantané. */
  generated_at: string;
};

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.user_id === "string" &&
    typeof v.pseudo === "string" &&
    typeof v.content === "string" &&
    typeof v.is_team === "boolean" &&
    typeof v.created_at === "string"
  );
}
