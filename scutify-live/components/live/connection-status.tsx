import { Loader2 } from "lucide-react";

import type { ConnectionState } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function ConnectionStatus({ state, className }: { state: ConnectionState; className?: string }) {
  if (state === "online") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
        <span className="size-2 animate-live-pulse rounded-full bg-brand-sky" aria-hidden />
        En direct
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {state === "connecting" ? "Connexion…" : "Reconnexion…"}
    </span>
  );
}

/** Bandeau bien visible pendant une coupure réseau. */
export function ReconnectingBanner({ state }: { state: ConnectionState }) {
  if (state !== "reconnecting") return null;
  return (
    <div
      className="flex items-center justify-center gap-2 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      Reconnexion… Les messages manqués s&apos;afficheront automatiquement.
    </div>
  );
}
