"use client";

import { MessageCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/hooks/use-live-chat";
import { PSEUDO_MAX_LENGTH } from "@/lib/chat/constants";
import { cleanText, validateEmail, validatePseudo } from "@/lib/chat/validation";

type Props = {
  onJoin: (pseudo: string, email: string) => Promise<ActionResult>;
};

export function JoinForm({ onJoin }: Props) {
  const [open, setOpen] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <Button className="h-11 w-full rounded-full text-[15px]" onClick={() => setOpen(true)}>
        <MessageCircle />
        Participer au chat
      </Button>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validatePseudo(pseudo) ?? validateEmail(email);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await onJoin(cleanText(pseudo), email.trim());
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  };

  // Compact : doit tenir au-dessus du clavier mobile (vidéo rétrécie).
  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="Pseudo"
          maxLength={PSEUDO_MAX_LENGTH}
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="next"
          aria-label="Pseudo (2 à 20 caractères)"
          className="h-10"
          autoFocus
          required
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="go"
          aria-label="Email"
          className="h-10"
          required
        />
      </div>
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-10 px-3" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button type="submit" className="h-10 flex-1 rounded-full" disabled={submitting}>
          {submitting ? "Connexion…" : "Rejoindre le chat"}
        </Button>
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        Ton email reste privé : il n&apos;est jamais affiché dans le chat.
      </p>
    </form>
  );
}
