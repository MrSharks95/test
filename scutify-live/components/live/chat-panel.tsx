"use client";

import { ChevronUp, Loader2 } from "lucide-react";

import { useNow } from "@/hooks/use-now";
import type { LiveChat } from "@/hooks/use-live-chat";
import type { LiveReactions } from "@/hooks/use-reactions";
import { isMutedNow } from "@/lib/chat/format";
import { activeQuickReplies } from "@/lib/chat/relance";

import { Composer } from "./composer";
import { ConnectionStatus, ReconnectingBanner } from "./connection-status";
import { JoinForm } from "./join-form";
import { MessageList } from "./message-list";
import { PinnedMessage } from "./pinned-message";
import { ReactionBar } from "./reaction-bar";

type Props = {
  chat: LiveChat;
  /** Réactions 🔥 💰 ❤️ 👍 en pied de chat (sans pseudo). */
  reactions?: LiveReactions;
  onBackToLive?: () => void;
};

export function ChatPanel({ chat, reactions, onBackToLive }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
        <h2 className="truncate text-sm font-extrabold uppercase tracking-wide text-brand-navy">
          <span className="lg:hidden">Scutify · </span>Chat en direct
        </h2>
        <div className="flex items-center gap-3">
          <ConnectionStatus
            state={chat.connection}
            className={chat.connection === "online" ? "text-brand-navy" : "text-amber-700"}
          />
          {onBackToLive && (
            // Paysage tactile : remonter à la vidéo.
            <button
              type="button"
              onClick={onBackToLive}
              className="hidden items-center gap-1 rounded-full bg-brand-navy px-3 py-1 text-xs font-bold text-white touchland:inline-flex"
            >
              <ChevronUp className="size-3.5" /> Live
            </button>
          )}
        </div>
      </header>

      <ReconnectingBanner state={chat.connection} />
      {chat.isAdmin && chat.settings?.live_open === false && (
        <div className="bg-sky-100 px-3 py-1.5 text-center text-xs font-semibold text-brand-navy">
          Aperçu équipe : les spectateurs voient encore la salle d&apos;attente (ouvre le live depuis l&apos;admin).
        </div>
      )}
      {chat.isAdmin && chat.settings?.chat_enabled === false && (
        <div className="bg-amber-100 px-3 py-1.5 text-center text-xs font-semibold text-amber-900">
          Chat fermé : masqué pour les spectateurs (tu le vois car tu es admin).
        </div>
      )}
      {/* Épingle en haut du chat (desktop / paysage). En portrait, la bannière
          sous la vidéo est déjà collée au-dessus du chat. */}
      <PinnedMessage
        settings={chat.settings}
        className="hidden border-b border-brand-navy-dark lg:flex touchland:flex"
      />

      {chat.phase === "ready" ? (
        <MessageList
          className="flex-1"
          messages={chat.messages}
          paused={chat.paused}
          pendingCount={chat.pendingCount}
          onPause={chat.pause}
          onResume={chat.resume}
          currentUserId={chat.userId}
          emptyState={
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucun message pour l&apos;instant. Lance la discussion ! 👋
            </p>
          }
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-brand-navy" />
          {chat.loadError ?? "Connexion au chat…"}
        </div>
      )}

      <footer className="pb-safe shrink-0 border-t bg-white px-3 pt-2">
        {reactions && <ReactionBar reactions={reactions} className="mb-2" />}
        <ChatFooter chat={chat} />
      </footer>
    </div>
  );
}

function ChatFooter({ chat }: { chat: LiveChat }) {
  const { phase, settings, profile, isAdmin } = chat;
  const mutedUntil = profile?.muted_until ?? null;
  // Rafraîchit l'affichage à l'expiration d'un mute.
  const relanceRunning = activeQuickReplies(settings, Date.now()).length > 0;
  const now = useNow((Boolean(mutedUntil) && isMutedNow(mutedUntil, Date.now())) || relanceRunning, 1000);
  // Relance : boutons visibles jusqu'à la fin (horloge rafraîchie chaque seconde).
  const quickReplies = activeQuickReplies(settings, now);

  const composer = (disabledReason: string | null) => (
    <Composer
      disabledReason={disabledReason}
      onSend={chat.sendMessage}
      nextAllowedAt={chat.nextAllowedAt}
      slowModeSeconds={settings?.slow_mode_seconds ?? 0}
      isAdmin={isAdmin}
      quickReplies={isAdmin ? [] : quickReplies}
    />
  );

  if (phase !== "ready" || !settings) return composer("Connexion au chat…");
  if (!settings.chat_enabled && !isAdmin) return composer("Le chat est fermé pour le moment");
  if (!profile) {
    return (
      <div className="space-y-2">
        {quickReplies.length > 0 && (
          <p className="text-center text-xs font-bold text-brand-navy">
            💬 L&apos;équipe vous pose une question : choisis un pseudo pour répondre en un clic !
          </p>
        )}
        <JoinForm onJoin={chat.joinChat} />
      </div>
    );
  }
  if (profile.banned || isMutedNow(mutedUntil, now)) return composer("Tu ne peux plus écrire dans le chat");
  return composer(null);
}
