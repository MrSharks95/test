const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date);
}

/** Secondes restantes (arrondi supérieur) avant `targetMs`. */
export function secondsUntil(targetMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
}

export function isMutedNow(mutedUntil: string | null, nowMs: number): boolean {
  if (!mutedUntil) return false;
  const until = Date.parse(mutedUntil);
  return !Number.isNaN(until) && until > nowMs;
}

export function formatMuteUntil(mutedUntil: string, nowMs: number): string {
  const until = Date.parse(mutedUntil);
  const minutes = Math.ceil((until - nowMs) / 60_000);
  if (minutes >= 6 * 60) return "jusqu'à la fin du live";
  if (minutes >= 60) return `encore ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  return `encore ${Math.max(1, minutes)} min`;
}
