"use client";

import { Pin } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { isSafeHttpUrl } from "@/lib/chat/linkify";
import type { ChatSettings } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type Props = {
  settings: Pick<ChatSettings, "pinned_message" | "pinned_url" | "pinned_label"> | null;
  className?: string;
};

/**
 * Bannière du message épinglé (sous la vidéo) : texte à gauche, bouton lien
 * à droite. Un texte long est tronqué à 2 lignes ; un appui l'affiche en
 * entier.
 */
export function PinnedMessage({ settings, className }: Props) {
  const [expanded, setExpanded] = useState(false);
  const message = settings?.pinned_message?.trim() || null;
  const url = isSafeHttpUrl(settings?.pinned_url) ? settings?.pinned_url : null;
  if (!message && !url) return null;

  return (
    <div
      role="region"
      aria-label="Message épinglé"
      className={cn("flex items-center gap-3 bg-brand-navy px-3 py-2 text-white sm:px-4", className)}
    >
      <Pin className="size-4 shrink-0 rotate-45 text-brand-sky" aria-hidden />
      {message ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            "min-w-0 flex-1 text-left text-sm font-semibold leading-snug [overflow-wrap:anywhere]",
            !expanded && "line-clamp-2",
          )}
        >
          {message}
        </button>
      ) : (
        <span className="flex-1" />
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "accent", size: "sm" }),
            "h-9 max-w-[60%] shrink-0 truncate px-3 text-sm sm:px-4",
          )}
        >
          {settings?.pinned_label?.trim() || "Ouvrir le lien"}
        </a>
      )}
    </div>
  );
}
