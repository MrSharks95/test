"use client";

import { Pin, PinOff, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { PinnedMessage } from "@/components/live/pinned-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PINNED_TEMPLATE } from "@/lib/chat/constants";
import { isSafeHttpUrl } from "@/lib/chat/linkify";
import type { ChatSettings } from "@/lib/chat/types";

type Props = {
  settings: ChatSettings;
  saving: boolean;
  onSave: (patch: Pick<ChatSettings, "pinned_message" | "pinned_label" | "pinned_url">) => Promise<boolean>;
};

export function PinPanel({ settings, saving, onSave }: Props) {
  const [message, setMessage] = useState(settings.pinned_message ?? "");
  const [label, setLabel] = useState(settings.pinned_label ?? "");
  const [url, setUrl] = useState(settings.pinned_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  // Suit les changements faits par un autre admin, sauf édition en cours.
  useEffect(() => {
    if (dirtyRef.current) return;
    setMessage(settings.pinned_message ?? "");
    setLabel(settings.pinned_label ?? "");
    setUrl(settings.pinned_url ?? "");
  }, [settings.pinned_message, settings.pinned_label, settings.pinned_url]);

  const edit = (setter: (v: string) => void) => (value: string) => {
    dirtyRef.current = true;
    setter(value);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    if (!message.trim() && !trimmedUrl) {
      setError("Écris un message ou ajoute un lien.");
      return;
    }
    if (trimmedUrl && !isSafeHttpUrl(trimmedUrl)) {
      setError("Le lien doit commencer par https://");
      return;
    }
    setError(null);
    const ok = await onSave({
      pinned_message: message.trim() || null,
      pinned_label: trimmedUrl ? label.trim() || null : null,
      pinned_url: trimmedUrl || null,
    });
    if (ok) dirtyRef.current = false;
  };

  const unpin = async () => {
    const ok = await onSave({ pinned_message: null, pinned_label: null, pinned_url: null });
    if (ok) {
      dirtyRef.current = false;
      setMessage("");
      setLabel("");
      setUrl("");
    }
  };

  const useTemplate = () => {
    dirtyRef.current = true;
    setMessage(PINNED_TEMPLATE.message);
    setLabel(PINNED_TEMPLATE.label);
    setUrl(PINNED_TEMPLATE.url);
  };

  const isPinned = Boolean(settings.pinned_message || settings.pinned_url);
  const preview = { pinned_message: message || null, pinned_label: label || null, pinned_url: url || null };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message épinglé</CardTitle>
        <CardDescription>Affiché en haut du chat pour tous les spectateurs, avec un bouton lien optionnel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Button type="button" variant="secondary" size="sm" onClick={useTemplate}>
            <Sparkles /> Modèle « Rejoindre la formation »
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="pin-message">Texte</Label>
            <Textarea
              id="pin-message"
              value={message}
              onChange={(e) => edit(setMessage)(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Ex. La formation est ouverte pendant le live !"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pin-label">Texte du bouton</Label>
              <Input
                id="pin-label"
                value={label}
                onChange={(e) => edit(setLabel)(e.target.value)}
                maxLength={60}
                placeholder="🚀 Rejoindre la formation"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-url">Lien du bouton</Label>
              <Input
                id="pin-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => edit(setUrl)(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          {(preview.pinned_message || preview.pinned_url) && (
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Aperçu</p>
              <PinnedMessage settings={preview} className="rounded-lg" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              <Pin /> Épingler
            </Button>
            {isPinned && (
              <Button type="button" variant="outline" disabled={saving} onClick={unpin}>
                <PinOff /> Retirer l&apos;épingle
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
