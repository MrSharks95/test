"use client";

import { Plus, Rocket, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNow } from "@/hooks/use-now";
import { secondsUntil } from "@/lib/chat/format";
import { activeQuickReplies } from "@/lib/chat/relance";
import type { ChatSettings } from "@/lib/chat/types";

export type RelancePreset = {
  id: string;
  message: string;
  replies: string[];
  seconds: number;
};

const STORAGE_KEY = "scutify-live-relances-v1";
const DURATIONS = [30, 60, 120] as const;
const MAX_REPLIES = 4;

const DEFAULT_PRESETS: RelancePreset[] = [
  {
    id: "action",
    message: "Si on vous donne ces 4 points clés, vous passez à l'action ? Répondez OUI 🔥",
    replies: ["OUI 🔥", "Chaud !", "🔥🔥🔥"],
    seconds: 60,
  },
  {
    id: "pret",
    message: "Vous êtes prêts pour la suite ? 🚀",
    replies: ["Prêt(e) ! 🚀", "GO 🔥", "💪"],
    seconds: 60,
  },
  {
    id: "parle",
    message: "Est-ce que ça vous parle ? Dites-le dans le chat 👇",
    replies: ["Grave ! 🙌", "Oui 💯", "🔥"],
    seconds: 60,
  },
  {
    id: "origine",
    message: "D'où vous nous regardez ce soir ? 🌍",
    replies: ["France 🇫🇷", "Belgique 🇧🇪", "Suisse 🇨🇭", "Ailleurs 🌍"],
    seconds: 60,
  },
];

function loadPresets(): RelancePreset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw) as RelancePreset[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PRESETS;
    return parsed.map((p, i) => ({
      id: typeof p.id === "string" ? p.id : `p${i}`,
      message: typeof p.message === "string" ? p.message : "",
      replies: Array.isArray(p.replies) ? p.replies.filter((r) => typeof r === "string").slice(0, MAX_REPLIES) : [],
      seconds: DURATIONS.includes(p.seconds as (typeof DURATIONS)[number]) ? p.seconds : 60,
    }));
  } catch {
    return DEFAULT_PRESETS;
  }
}

type Props = {
  settings: ChatSettings;
  onLaunch: (preset: RelancePreset) => Promise<boolean>;
  onStop: () => Promise<boolean>;
};

export function RelancePanel({ settings, onLaunch, onStop }: Props) {
  const [presets, setPresets] = useState<RelancePreset[]>(DEFAULT_PRESETS);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const save = (next: RelancePreset[]) => {
    setPresets(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // stockage indisponible (navigation privée) : modifications non conservées
    }
  };

  const update = (id: string, patch: Partial<RelancePreset>) =>
    save(presets.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const running = activeQuickReplies(settings, Date.now()).length > 0;
  const now = useNow(running, 1000);
  const active = activeQuickReplies(settings, now);
  const remaining = active.length > 0 ? secondsUntil(Date.parse(settings.quick_replies_until as string), now) : 0;

  const launch = async (preset: RelancePreset) => {
    setBusy(preset.id);
    await onLaunch(preset);
    setBusy(null);
  };

  const stop = async () => {
    setBusy("stop");
    await onStop();
    setBusy(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relances</CardTitle>
        <CardDescription>
          Un message Équipe + des boutons de réponse rapide chez les spectateurs : un appui envoie un vrai message
          (slow mode, anti-spam et mots-clés s&apos;appliquent). Tes relances sont mémorisées sur cet appareil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {active.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-brand-sky bg-brand-sky-light p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-brand-navy">🔥 Relance en cours · {remaining} s</p>
              <p className="truncate text-xs text-brand-navy/80">{active.join(" · ")}</p>
            </div>
            <Button size="sm" variant="outline" disabled={busy === "stop"} onClick={() => void stop()}>
              <Square /> Arrêter
            </Button>
          </div>
        )}

        {presets.map((preset) => (
          <div key={preset.id} className="space-y-2 rounded-lg border p-3">
            <Textarea
              value={preset.message}
              onChange={(e) => update(preset.id, { message: e.target.value })}
              rows={2}
              maxLength={300}
              placeholder="Message de l'équipe (facultatif)"
              aria-label="Message de la relance"
              className="min-h-0 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: MAX_REPLIES }, (_, i) => (
                <Input
                  key={i}
                  value={preset.replies[i] ?? ""}
                  onChange={(e) => {
                    const replies = [...preset.replies];
                    replies[i] = e.target.value;
                    update(preset.id, { replies: replies.slice(0, MAX_REPLIES) });
                  }}
                  maxLength={40}
                  placeholder={`Bouton ${i + 1}`}
                  aria-label={`Bouton de réponse ${i + 1}`}
                  className="h-9 text-sm"
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Durée">
                {DURATIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={preset.seconds === s}
                    onClick={() => update(preset.id, { seconds: s })}
                    className={
                      preset.seconds === s
                        ? "rounded px-2 py-1 text-xs font-bold text-white bg-brand-navy"
                        : "rounded px-2 py-1 text-xs font-semibold text-muted-foreground"
                    }
                  >
                    {s} s
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="ml-auto"
                disabled={busy !== null || preset.replies.every((r) => !r?.trim())}
                onClick={() => void launch(preset)}
              >
                <Rocket /> Lancer
              </Button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              save([...presets, { id: `p${Date.now()}`, message: "", replies: ["", "", ""], seconds: 60 }])
            }
          >
            <Plus /> Nouvelle relance
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => save(DEFAULT_PRESETS)}>
            <RotateCcw /> Relances par défaut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
