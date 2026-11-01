"use client";

import { useEffect, useRef, useState } from "react";

import type { LiveChat } from "@/hooks/use-live-chat";
import { emptyCounts, REACTIONS, type ReactionCounts, sumSince } from "@/lib/chat/reactions";
import { cn } from "@/lib/utils";

const WINDOW_MS = 60_000;

/**
 * Réactions reçues pendant la dernière minute (mêmes lots que les
 * spectateurs) : pour rebondir en direct (« je vois vos flammes ! »).
 */
export function ReactionStats({ chat, className }: { chat: LiveChat; className?: string }) {
  const { onReactions } = chat;
  const entriesRef = useRef<{ at: number; counts: ReactionCounts }[]>([]);
  const [totals, setTotals] = useState<ReactionCounts>(emptyCounts);

  useEffect(() => {
    const refresh = () => {
      const since = Date.now() - WINDOW_MS;
      entriesRef.current = entriesRef.current.filter((e) => e.at >= since);
      setTotals(sumSince(entriesRef.current, since));
    };
    const unsubscribe = onReactions((counts) => {
      entriesRef.current.push({ at: Date.now(), counts });
      refresh();
    });
    const id = setInterval(refresh, 5_000);
    return () => {
      unsubscribe();
      clearInterval(id);
    };
  }, [onReactions]);

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)} aria-label="Réactions de la dernière minute">
      <span className="text-xs font-semibold text-muted-foreground">1 min :</span>
      {REACTIONS.map((r) => (
        <span key={r.kind} className="inline-flex items-center gap-0.5 font-bold tabular-nums text-brand-navy">
          <span aria-hidden>{r.emoji}</span>
          {formatCount(totals[r.kind])}
        </span>
      ))}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return String(n);
}
