"use client";

import { Eye, EyeOff } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  onLabel: string;
  offLabel: string;
};

/** Interrupteur « affiché / masqué » d'un contenu préparé à l'avance. */
export function VisibilitySwitch({ checked, disabled, onChange, onLabel, offLabel }: Props) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5",
        checked ? "border-emerald-300 bg-emerald-50" : "border-border bg-muted/60",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={checked ? onLabel : offLabel} />
      <span className={cn("flex items-center gap-2 text-sm font-bold", checked ? "text-emerald-800" : "text-muted-foreground")}>
        {checked ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {checked ? onLabel : offLabel}
      </span>
    </label>
  );
}
