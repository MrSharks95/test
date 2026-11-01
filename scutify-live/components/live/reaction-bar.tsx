"use client";

import type { LiveReactions } from "@/hooks/use-reactions";
import { REACTIONS } from "@/lib/chat/reactions";
import { cn } from "@/lib/utils";

type Props = {
  reactions: LiveReactions;
  /** light : pied du chat ; dark : sous la vidéo (chat fermé). */
  tone?: "light" | "dark";
  className?: string;
};

/**
 * Boutons 🔥 💰 ❤️ 👍, accessibles sans pseudo. Les émojis montent au-dessus
 * des boutons (par-dessus le fil du chat ou la vidéo).
 */
export function ReactionBar({ reactions, tone = "light", className }: Props) {
  if (!reactions.enabled) return null;
  const dark = tone === "dark";

  return (
    <div className={cn("live-reactions flex items-center justify-between gap-3", className)}>
      <span
        className={cn(
          "min-w-0 truncate text-xs font-extrabold uppercase tracking-wide",
          dark ? "text-white/80" : "text-brand-navy",
        )}
      >
        Réagis au live
      </span>
      <div className="relative flex shrink-0 items-center gap-1.5" role="group" aria-label="Réactions">
        {/* Couche des émojis animés : part du haut des boutons, sans bloquer les clics. */}
        <div
          ref={reactions.setLayer}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-full z-20 h-0 overflow-visible"
        />
        {REACTIONS.map((reaction) => (
          <button
            key={reaction.kind}
            type="button"
            onClick={() => reactions.tap(reaction.kind)}
            // Pas de vol de focus (ni de zoom au double appui) : on peut taper vite.
            onPointerDown={(e) => e.preventDefault()}
            aria-label={reaction.label}
            title={reaction.label}
            className={cn(
              "grid size-10 touch-manipulation select-none place-items-center rounded-full text-xl transition-transform duration-100 hover:scale-110 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky",
              dark ? "bg-white/10 ring-1 ring-white/15 hover:bg-white/20" : "bg-muted hover:bg-brand-sky-light",
            )}
          >
            <span aria-hidden>{reaction.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
