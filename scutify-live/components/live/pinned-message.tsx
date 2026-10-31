"use client";

import { ChevronDown, Pin } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { isSafeHttpUrl } from "@/lib/chat/linkify";
import type { ChatSettings } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type Props = {
  settings: Pick<ChatSettings, "pinned_message" | "pinned_url" | "pinned_label"> | null;
  className?: string;
};

export function PinnedMessage({ settings, className }: Props) {
  const [expanded, setExpanded] = useState(false);
  const message = settings?.pinned_message?.trim() || null;
  const url = isSafeHttpUrl(settings?.pinned_url) ? settings?.pinned_url : null;
  if (!message && !url) return null;

  const isLong = (message?.length ?? 0) > 110;

  return (
    <div className={cn("border-b border-brand-navy-dark bg-brand-navy px-3 py-2.5 text-white", className)}>
      <div className="flex items-start gap-2">
        <Pin className="mt-0.5 size-4 shrink-0 rotate-45 text-brand-sky" aria-label="Message épinglé" />
        <div className="min-w-0 flex-1">
          {message && (
            <p
              className={cn("text-sm font-medium leading-snug [overflow-wrap:anywhere]", !expanded && isLong && "line-clamp-2")}
            >
              {message}
            </p>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "accent", size: "sm" }), "mt-2 h-9 max-w-full whitespace-normal text-sm")}
            >
              {settings?.pinned_label?.trim() || "Ouvrir le lien"}
            </a>
          )}
        </div>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1 text-brand-sky hover:bg-white/10"
            aria-label={expanded ? "Réduire le message épinglé" : "Afficher tout le message épinglé"}
            aria-expanded={expanded}
          >
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>
    </div>
  );
}
