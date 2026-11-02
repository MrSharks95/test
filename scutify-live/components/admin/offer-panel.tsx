"use client";

import { Eye, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CustomBlock } from "@/components/live/custom-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { VisibilitySwitch } from "./visibility-switch";

const MAX_LENGTH = 30_000;

type Props = {
  html: string | null;
  /** Bloc affiché aux spectateurs (le contenu reste enregistré sinon). */
  enabled: boolean;
  saving: boolean;
  onSave: (html: string | null) => Promise<boolean>;
  onToggle: (enabled: boolean) => void;
};

export function OfferPanel({ html, enabled, saving, onSave, onToggle }: Props) {
  const [value, setValue] = useState(html ?? "");
  const [preview, setPreview] = useState(html ?? "");
  const dirtyRef = useRef(false);

  // Suit les modifications d'un autre admin, sauf édition en cours.
  useEffect(() => {
    if (dirtyRef.current) return;
    setValue(html ?? "");
    setPreview(html ?? "");
  }, [html]);

  const save = async (next: string | null) => {
    const ok = await onSave(next);
    if (ok) {
      dirtyRef.current = false;
      setValue(next ?? "");
      setPreview(next ?? "");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bloc « Offre » sous la vidéo</CardTitle>
        <CardDescription>
          Prépare ton bloc à l&apos;avance : il reste enregistré et n&apos;apparaît chez les spectateurs que lorsque tu
          l&apos;affiches (sous la vidéo sur ordinateur, bouton « 🎁 Voir l&apos;offre » sur téléphone). Les scripts sont
          retirés automatiquement, les liens s&apos;ouvrent dans un nouvel onglet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <VisibilitySwitch
          checked={enabled}
          disabled={saving || (!html && !enabled)}
          onChange={onToggle}
          onLabel="Offre affichée aux spectateurs"
          offLabel={html ? "Offre prête, masquée" : "Enregistre d'abord un bloc"}
        />
        <Textarea
          value={value}
          onChange={(e) => {
            dirtyRef.current = true;
            setValue(e.target.value);
          }}
          rows={10}
          maxLength={MAX_LENGTH}
          spellCheck={false}
          placeholder='<div style="...">…</div>'
          className="font-mono text-xs leading-relaxed"
          aria-label="Code HTML du bloc"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setPreview(value)}>
            <Eye /> Aperçu
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save(value.trim() || null)}>
            <Save /> Enregistrer
          </Button>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {value.length.toLocaleString("fr-FR")} / {MAX_LENGTH.toLocaleString("fr-FR")}
          </span>
        </div>

        {preview.trim() && (
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Aperçu</p>
            <div className="max-h-[480px] overflow-y-auto rounded-lg border bg-slate-50 p-3">
              <CustomBlock html={preview} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
