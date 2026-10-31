import { memo, type ReactNode, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/chat/format";
import { linkify } from "@/lib/chat/linkify";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type Props = {
  message: ChatMessage;
  isOwn: boolean;
  /** Doit être stable (useCallback) pour préserver la mémoïsation. */
  renderActions?: (message: ChatMessage) => ReactNode;
};

export const MessageItem = memo(function MessageItem({ message, isOwn, renderActions }: Props) {
  const parts = useMemo(() => linkify(message.content), [message.content]);

  return (
    <li
      className={cn(
        "px-3 py-1.5 text-[15px] leading-snug [overflow-wrap:anywhere]",
        message.is_team && "mx-2 my-1 rounded-lg border-l-4 border-brand-sky bg-brand-sky-light px-3 py-2",
        isOwn && !message.is_team && "bg-slate-50",
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1">
          <time
            dateTime={message.created_at}
            className="mr-1.5 align-[1px] text-[11px] font-medium tabular-nums text-muted-foreground"
          >
            {formatTime(message.created_at)}
          </time>
          {message.is_team && (
            <Badge variant="team" className="mr-1.5 align-[2px]">
              Équipe
            </Badge>
          )}
          <span className={cn("font-bold", message.is_team ? "text-brand-navy" : "text-brand-navy-light")}>
            {message.pseudo}
          </span>
          <span className="text-muted-foreground"> : </span>
          <span className={cn("text-foreground", message.is_team && "font-medium text-brand-navy")}>
            {parts.map((part, index) =>
              part.type === "link" ? (
                <a
                  key={index}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="font-semibold text-brand-navy-light underline underline-offset-2"
                >
                  {part.value}
                </a>
              ) : (
                <span key={index}>{part.value}</span>
              ),
            )}
          </span>
        </p>
        {renderActions?.(message)}
      </div>
    </li>
  );
});
