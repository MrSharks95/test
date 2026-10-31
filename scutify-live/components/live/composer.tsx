"use client";

import { Lock, SendHorizontal } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import type { ActionResult } from "@/hooks/use-live-chat";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/constants";
import { secondsUntil } from "@/lib/chat/format";
import { cleanText } from "@/lib/chat/validation";
import { cn } from "@/lib/utils";

type Props = {
  /** Si défini : champ désactivé, ce texte sert de placeholder. */
  disabledReason?: string | null;
  onSend: (content: string) => Promise<ActionResult>;
  nextAllowedAt: number;
  slowModeSeconds: number;
  isAdmin: boolean;
  placeholder?: string;
};

export function Composer({
  disabledReason,
  onSend,
  nextAllowedAt,
  slowModeSeconds,
  isAdmin,
  placeholder = "Écris ton message…",
}: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const now = useNow(nextAllowedAt > Date.now(), 250);
  const remaining = isAdmin ? 0 : secondsUntil(nextAllowedAt, now);
  const slowMode = slowModeSeconds > 0 && !isAdmin;
  const disabled = Boolean(disabledReason);
  const length = value.length;

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(id);
  }, [error]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = cleanText(value);
    if (!content || sending || remaining > 0 || disabled) return;

    setSending(true);
    setError(null);
    setValue(""); // vidé tout de suite : l'envoi paraît instantané
    const result = await onSend(content);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      setValue((current) => current || content);
    }
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          {disabled && (
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            ref={inputRef}
            value={disabled ? "" : value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            placeholder={disabledReason ?? placeholder}
            maxLength={MAX_MESSAGE_LENGTH}
            enterKeyHint="send"
            autoComplete="off"
            aria-label="Écrire un message"
            aria-invalid={Boolean(error)}
            className={cn("h-11 rounded-full px-4", disabled && "pl-9 placeholder:font-semibold")}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={disabled || sending || remaining > 0 || cleanText(value).length === 0}
          // Garde le focus dans le champ : le clavier mobile reste ouvert.
          onPointerDown={(e) => e.preventDefault()}
          className="size-11 shrink-0 rounded-full"
          aria-label={remaining > 0 ? `Patiente ${remaining} secondes` : "Envoyer"}
        >
          {remaining > 0 ? <span className="text-xs font-bold tabular-nums">{remaining}s</span> : <SendHorizontal />}
        </Button>
      </div>

      {!disabled && (error || slowMode || length > MAX_MESSAGE_LENGTH - 50) && (
        <div className="flex items-center justify-between gap-2 px-2 text-xs">
          <p
            className={cn("min-w-0 font-medium", error ? "text-destructive" : "text-muted-foreground")}
            role={error ? "alert" : undefined}
          >
            {error ??
              (slowMode
                ? remaining > 0
                  ? `🐢 Mode lent : prochain message dans ${remaining} s`
                  : `🐢 Mode lent : 1 message toutes les ${slowModeSeconds} s`
                : null)}
          </p>
          {length > MAX_MESSAGE_LENGTH - 50 && (
            <span
              className={cn(
                "shrink-0 tabular-nums",
                length >= MAX_MESSAGE_LENGTH ? "font-bold text-destructive" : "text-muted-foreground",
              )}
            >
              {length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
