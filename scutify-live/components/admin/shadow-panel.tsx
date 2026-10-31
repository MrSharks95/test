"use client";

import { Eye, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime } from "@/lib/chat/format";
import type { ChatMessage } from "@/lib/chat/types";

import { MessageActions, type ModerationHandlers } from "./message-actions";

type Props = {
  messages: ChatMessage[] | null;
  loading: boolean;
  onRefresh: () => void;
  onApprove: (message: ChatMessage) => void;
} & ModerationHandlers;

export function ShadowPanel({ messages, loading, onRefresh, onApprove, ...moderation }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Messages bloqués</CardTitle>
          <CardDescription>
            Contiennent un mot-clé bloqué : visibles uniquement par leur auteur. Actualisé toutes les 10 s.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Actualiser">
          <RefreshCw />
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !messages ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : !messages || messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun message bloqué. ✅</p>
        ) : (
          <ul className="divide-y">
            {messages.map((message) => (
              <li key={message.id} className="space-y-2 py-3">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
                    <span className="mr-1.5 text-[11px] tabular-nums text-muted-foreground">
                      {formatTime(message.created_at)}
                    </span>
                    <span className="font-bold text-brand-navy-light">{message.pseudo}</span>
                    <span className="text-muted-foreground"> : </span>
                    {message.content}
                  </p>
                  <MessageActions message={message} {...moderation} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onApprove(message)}>
                    <Eye /> Rendre visible
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => moderation.onDelete(message)}>
                    <Trash2 /> Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
