"use client";

import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SLOW_MODE_OPTIONS } from "@/lib/chat/constants";
import type { ChatSettings } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type Props = {
  settings: ChatSettings;
  saving: boolean;
  onUpdate: (patch: Partial<ChatSettings>) => void;
  onClear: () => void;
  /** Compteurs de réactions (dernière minute). */
  reactionStats?: ReactNode;
  /** Un bloc « Offre » est enregistré (sinon rien à afficher). */
  hasOffer?: boolean;
  onToggleVisibility?: (patch: { custom_html_enabled: boolean } | { pinned_enabled: boolean }) => void;
};

export function ControlsBar({
  settings,
  saving,
  onUpdate,
  onClear,
  reactionStats,
  hasOffer = false,
  onToggleVisibility,
}: Props) {
  const offerOn = settings.custom_html_enabled === true;
  const pinOn = settings.pinned_enabled === true;
  const hasPin = Boolean(settings.pinned_message || settings.pinned_url);
  const reactionsOn = settings.reactions_enabled !== false;
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex cursor-pointer items-center gap-3">
          <Switch
            checked={settings.chat_enabled}
            disabled={saving}
            onCheckedChange={(checked) => onUpdate({ chat_enabled: checked })}
            aria-label="Ouvrir ou fermer le chat"
          />
          <span className={cn("text-sm font-bold", settings.chat_enabled ? "text-brand-navy" : "text-destructive")}>
            {settings.chat_enabled ? "Chat ouvert" : "Chat fermé et masqué"}
          </span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-brand-navy">Slow mode</span>
          <div role="radiogroup" aria-label="Slow mode" className="inline-flex rounded-lg bg-muted p-1">
            {SLOW_MODE_OPTIONS.map((seconds) => {
              const active = settings.slow_mode_seconds === seconds;
              return (
                <button
                  key={seconds}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={saving}
                  onClick={() => onUpdate({ slow_mode_seconds: seconds })}
                  className={cn(
                    "min-w-11 rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60",
                    active ? "bg-brand-navy text-white shadow" : "text-muted-foreground hover:text-brand-navy",
                  )}
                >
                  {seconds === 0 ? "Off" : `${seconds} s`}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <Switch
            checked={settings.links_allowed}
            disabled={saving}
            onCheckedChange={(checked) => onUpdate({ links_allowed: checked })}
            aria-label="Autoriser les liens"
          />
          <span className="text-sm font-bold text-brand-navy">
            {settings.links_allowed ? "Liens autorisés" : "Liens bloqués"}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="flex cursor-pointer items-center gap-3">
            <Switch
              checked={reactionsOn}
              disabled={saving}
              onCheckedChange={(checked) => onUpdate({ reactions_enabled: checked })}
              aria-label="Activer ou désactiver les réactions"
            />
            <span className="text-sm font-bold text-brand-navy">
              {reactionsOn ? "Réactions 🔥 activées" : "Réactions désactivées"}
            </span>
          </label>
          {reactionsOn && reactionStats}
        </div>

        {onToggleVisibility && (
          <>
            <label className="flex cursor-pointer items-center gap-3">
              <Switch
                checked={offerOn}
                disabled={saving || (!hasOffer && !offerOn)}
                onCheckedChange={(checked) => onToggleVisibility({ custom_html_enabled: checked })}
                aria-label="Afficher ou masquer l'offre"
              />
              <span className={cn("text-sm font-bold", offerOn ? "text-emerald-700" : "text-muted-foreground")}>
                {offerOn ? "🎁 Offre affichée" : "🎁 Offre masquée"}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <Switch
                checked={pinOn}
                disabled={saving || (!hasPin && !pinOn)}
                onCheckedChange={(checked) => onToggleVisibility({ pinned_enabled: checked })}
                aria-label="Afficher ou masquer l'épingle"
              />
              <span className={cn("text-sm font-bold", pinOn ? "text-emerald-700" : "text-muted-foreground")}>
                {pinOn ? "📌 Épingle affichée" : "📌 Épingle masquée"}
              </span>
            </label>
          </>
        )}

        <Button variant="destructive" size="sm" className="h-9 sm:ml-auto" onClick={onClear}>
          <Trash2 /> Vider le chat
        </Button>
      </div>
    </Card>
  );
}
