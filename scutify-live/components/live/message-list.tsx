"use client";

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

import { MessageItem } from "./message-item";

type Props = {
  messages: ChatMessage[];
  paused: boolean;
  pendingCount: number;
  onPause: () => void;
  onResume: () => void;
  currentUserId: string | null;
  renderActions?: (message: ChatMessage) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
};

/** Distance (px) au bas du fil en deçà de laquelle on considère être « en bas ». */
const BOTTOM_THRESHOLD = 48;

/**
 * Fil de messages :
 * - suit automatiquement le bas du fil ;
 * - si l'utilisateur remonte, le fil se met en pause (les nouveaux messages
 *   sont mis en attente par le reducer) et un bouton « ⬇ Nouveaux messages »
 *   apparaît ;
 * - revenir en bas (scroll ou bouton) reprend le direct.
 */
export function MessageList({
  messages,
  paused,
  pendingCount,
  onPause,
  onResume,
  currentUserId,
  renderActions,
  emptyState,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLOListElement>(null);
  const followRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (followRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  // Le conteneur change de taille (clavier mobile, message épinglé…) : rester en bas.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (followRef.current) scrollToBottom();
    });
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  // Reprise déclenchée ailleurs (ex. envoi d'un message) : on revient en bas.
  useEffect(() => {
    if (!paused) {
      followRef.current = true;
      scrollToBottom();
    }
  }, [paused, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    if (atBottom && !followRef.current) {
      followRef.current = true;
      onResume();
    } else if (!atBottom && followRef.current) {
      followRef.current = false;
      onPause();
    }
  }, [onPause, onResume]);

  const jumpToLive = useCallback(() => {
    followRef.current = true;
    onResume();
    requestAnimationFrame(scrollToBottom);
  }, [onResume, scrollToBottom]);

  return (
    <div className={cn("relative min-h-0", className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-thin h-full overflow-y-auto overscroll-contain py-2"
        role="log"
        aria-live="off"
        aria-label="Messages du chat"
      >
        {messages.length === 0 && emptyState}
        <ol ref={contentRef} className="flex flex-col">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isOwn={message.user_id === currentUserId}
              renderActions={renderActions}
            />
          ))}
        </ol>
      </div>

      {paused && (
        <button
          type="button"
          onClick={jumpToLive}
          className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20 transition hover:bg-brand-navy-light"
        >
          {pendingCount > 0 ? (
            <>
              ⬇ Nouveaux messages
              <span className="rounded-full bg-brand-sky px-1.5 text-xs font-bold text-brand-navy">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            </>
          ) : (
            "⬇ Revenir au direct"
          )}
        </button>
      )}
    </div>
  );
}
