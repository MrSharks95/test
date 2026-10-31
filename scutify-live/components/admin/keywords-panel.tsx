"use client";

import { Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type BlockedKeyword = { id: number; keyword: string };

type Props = {
  keywords: BlockedKeyword[] | null;
  loading: boolean;
  onAdd: (keyword: string) => Promise<boolean>;
  onRemove: (keyword: BlockedKeyword) => void;
};

export function KeywordsPanel({ keywords, loading, onAdd, onRemove }: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const keyword = value.trim();
    if (!keyword) return;
    setSubmitting(true);
    const ok = await onAdd(keyword);
    setSubmitting(false);
    if (ok) setValue("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mots-clés bloqués</CardTitle>
        <CardDescription>
          Un message qui en contient un est masqué pour tous sauf son auteur (onglet « Bloqués »). Insensible à la
          casse et aux accents, mot entier. Astuce : <code className="font-semibold">arnaque*</code> bloque aussi
          « arnaques », « arnaqueur »…
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            placeholder="Ajouter un mot ou une expression"
            aria-label="Nouveau mot-clé"
          />
          <Button type="submit" disabled={submitting || !value.trim()} className="shrink-0">
            <Plus /> Ajouter
          </Button>
        </form>

        {loading && !keywords ? (
          <p className="text-center text-sm text-muted-foreground">Chargement…</p>
        ) : !keywords || keywords.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Aucun mot-clé bloqué.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <li key={keyword.id}>
                <Badge variant="secondary" className="gap-1 py-1 pl-3 pr-1 text-sm normal-case tracking-normal">
                  {keyword.keyword}
                  <button
                    type="button"
                    onClick={() => onRemove(keyword)}
                    className="rounded-full p-1 hover:bg-brand-navy/10"
                    aria-label={`Supprimer « ${keyword.keyword} »`}
                  >
                    <X className="size-3.5" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
