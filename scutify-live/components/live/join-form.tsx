"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/hooks/use-live-chat";
import { PSEUDO_MAX_LENGTH } from "@/lib/chat/constants";
import { cleanText, validatePseudo } from "@/lib/chat/validation";

type Props = {
  onJoin: (pseudo: string) => Promise<ActionResult>;
};

/**
 * Rejoindre le chat : un pseudo suffit (le chat est lisible sans rien
 * saisir). Un seul champ, directement en bas du chat.
 */
export function JoinForm({ onJoin }: Props) {
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validatePseudo(pseudo);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await onJoin(cleanText(pseudo));
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <form onSubmit={submit} className="space-y-1.5" noValidate>
      <div className="flex items-center gap-2">
        <Input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="Ton pseudo pour écrire"
          maxLength={PSEUDO_MAX_LENGTH}
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="go"
          aria-label="Pseudo (2 à 20 caractères)"
          aria-invalid={Boolean(error)}
          className="h-11 min-w-0 flex-1 rounded-full px-4"
        />
        <Button type="submit" className="h-11 shrink-0 rounded-full px-5" disabled={submitting}>
          {submitting ? "…" : "Rejoindre"}
        </Button>
      </div>
      {error && (
        <p className="px-2 text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
