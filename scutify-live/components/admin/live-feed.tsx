"use client";

import type { ReactNode } from "react";

import { Composer } from "@/components/live/composer";
import { ConnectionStatus, ReconnectingBanner } from "@/components/live/connection-status";
import { MessageList } from "@/components/live/message-list";
import { Card } from "@/components/ui/card";
import type { LiveChat } from "@/hooks/use-live-chat";
import type { ChatMessage } from "@/lib/chat/types";

type Props = {
  chat: LiveChat;
  renderActions: (message: ChatMessage) => ReactNode;
};

export function LiveFeed({ chat, renderActions }: Props) {
  return (
    <Card className="flex h-[calc(100dvh-15rem)] min-h-[420px] flex-col overflow-hidden lg:h-[calc(100dvh-12.5rem)]">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-brand-navy">Fil du chat en direct</h2>
        <ConnectionStatus
          state={chat.connection}
          className={chat.connection === "online" ? "text-brand-navy" : "text-amber-700"}
        />
      </div>
      <ReconnectingBanner state={chat.connection} />

      <MessageList
        className="flex-1"
        messages={chat.messages}
        paused={chat.paused}
        pendingCount={chat.pendingCount}
        onPause={chat.pause}
        onResume={chat.resume}
        currentUserId={chat.userId}
        renderActions={renderActions}
        emptyState={<p className="px-6 py-10 text-center text-sm text-muted-foreground">Aucun message visible.</p>}
      />

      <div className="shrink-0 border-t bg-brand-sky-light/60 p-3">
        <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-brand-navy">
          Envoyer en tant qu&apos;Équipe
        </p>
        <Composer
          onSend={chat.sendMessage}
          nextAllowedAt={0}
          slowModeSeconds={0}
          isAdmin
          placeholder="Message de l'équipe…"
        />
      </div>
    </Card>
  );
}
