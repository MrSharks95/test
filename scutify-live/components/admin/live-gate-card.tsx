"use client";

import { Clock, Play, Undo2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatStartDate, parseStartsAt, toDateTimeLocal } from "@/lib/chat/countdown";
import type { ChatSettings } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type Props = {
  settings: ChatSettings;
  saving: boolean;
  /** Ouvre (true) ou remet (false) la salle d'attente, après confirmation. */
  onToggle: (open: boolean) => void;
  onSaveStart: (iso: string) => Promise<boolean>;
};

/**
 * Salle d'attente : tant que le live n'est pas ouvert, les spectateurs ne
 * voient qu'un compte à rebours. Un clic ouvre le live chez tout le monde.
 */
export function LiveGateCard({ settings, saving, onToggle, onSaveStart }: Props) {
  const open = settings.live_open !== false;
  const startsAt = parseStartsAt(settings.live_starts_at);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => (startsAt ? toDateTimeLocal(startsAt) : ""));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return;
    if (await onSaveStart(new Date(ms).toISOString())) setEditing(false);
  };

  return (
    <Card
      className={cn(
        "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4",
        open ? "border-emerald-300 bg-emerald-50" : "border-sky-300 bg-sky-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-brand-navy">
          {open ? "🎬 Live ouvert : les spectateurs voient la vidéo" : "⏳ Salle d'attente : les spectateurs voient le compte à rebours"}
        </p>
        {!open &&
          (editing ? (
            <form onSubmit={save} className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 w-auto bg-white"
                aria-label="Début du live"
                required
              />
              <Button type="submit" size="sm" className="h-9" disabled={saving}>
                Enregistrer
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </form>
          ) : (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-brand-navy/80">
              <Clock className="size-3.5" aria-hidden />
              Compte à rebours jusqu&apos;à{" "}
              <strong>{startsAt ? `${formatStartDate(startsAt)} (heure de Paris)` : "— (non défini)"}</strong>
              <button
                type="button"
                onClick={() => {
                  setValue(startsAt ? toDateTimeLocal(startsAt) : "");
                  setEditing(true);
                }}
                className="font-semibold text-brand-navy underline underline-offset-2"
              >
                modifier
              </button>
            </p>
          ))}
        {!open && (
          <p className="mt-1 text-xs text-brand-navy/70">
            Tout le monde (équipe comprise) voit la salle d&apos;attente sur /live.{" "}
            <a
              href="/live?equipe"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-navy underline underline-offset-2"
            >
              Vérifier la vidéo (équipe)
            </a>
          </p>
        )}
      </div>

      {open ? (
        <Button variant="outline" size="sm" className="h-9 shrink-0" disabled={saving} onClick={() => onToggle(false)}>
          <Undo2 /> Remettre la salle d&apos;attente
        </Button>
      ) : (
        <Button size="lg" className="h-11 shrink-0 text-base font-extrabold" disabled={saving} onClick={() => onToggle(true)}>
          <Play /> Ouvrir le live
        </Button>
      )}
    </Card>
  );
}
