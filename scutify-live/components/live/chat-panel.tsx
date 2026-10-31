"use client";

import { Loader2 } from "lucide-react";

import { useNow } from "@/hooks/use-now";
import type { LiveChat } from "@/hooks/use-live-chat";
import { isMutedNow } from "@/lib/chat/format";

import { Composer } from "./composer";
import { ConnectionStatus, ReconnectingBanner } from "./connection-status";
import { JoinForm } from "./join-form";
import { MessageList } from "./message-list";
import { PinnedMessage } from "./pinned-message";

export function ChatPanel({ chat }: { chat: LiveChat }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
        <h2 className="truncate text-sm font-extrabold uppercase tracking-wide text-brand-navy">
          <span className="lg:hidden">Scutify · </span>Chat en direct
        </h2>
        <ConnectionStatus
          state={chat.connection}
          className={chat.connection === "online" ? "text-brand-navy" : "text-amber-700"}
        />
      </header>

      <ReconnectingBanner state={chat.connection} />
      <PinnedMessage settings={chat.settings} className="live-pinned" />

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
        <ChatFooter chat={chat} />
      </footer>
    </div>
  );
}

function ChatFooter({ chat }: { chat: LiveChat }) {
  const { phase, settings, profile, isAdmin } = chat;
  const mutedUntil = profile?.muted_until ?? null;
  // Rafraîchit l'affichage à l'expiration d'un mute.
  const now = useNow(Boolean(mutedUntil) && isMutedNow(mutedUntil, Date.now()), 1000);

  const composer = (disabledReason: string | null) => (
    <Composer
      disabledReason={disabledReason}
      onSend={chat.sendMessage}
      nextAllowedAt={chat.nextAllowedAt}
      slowModeSeconds={settings?.slow_mode_seconds ?? 0}
      isAdmin={isAdmin}
    />
  );

  if (phase !== "ready" || !settings) return composer("Connexion au chat…");
  if (!settings.chat_enabled && !isAdmin) return composer("Le chat est fermé pour le moment");
  if (!profile) return <JoinForm onJoin={chat.joinChat} />;
  if (profile.banned || isMutedNow(mutedUntil, now)) return composer("Tu ne peux plus écrire dans le chat");
  return composer(null);
}
