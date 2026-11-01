/**
 * Salle d'attente : compte à rebours jusqu'au début du live (logique pure).
 */

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** L'heure de début est atteinte (ou dépassée). */
  done: boolean;
};

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const remaining = Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
  return {
    days: Math.floor(remaining / 86_400),
    hours: Math.floor((remaining % 86_400) / 3_600),
    minutes: Math.floor((remaining % 3_600) / 60),
    seconds: remaining % 60,
    done: remaining === 0,
  };
}

export function parseStartsAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** « Lundi 2 novembre à 20h00 », toujours à l'heure de Paris. */
export function formatStartDate(ms: number): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${get("day")} ${get("month")} à ${get("hour")}h${get("minute")}`;
}

/** Valeur d'un <input type="datetime-local"> (heure locale de l'appareil). */
export function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Début du live si les réglages sont illisibles (identique au défaut SQL). */
export const DEFAULT_LIVE_STARTS_AT = "2026-11-02T19:00:00Z";

export type LiveGate = "loading" | "waiting" | "live";

/**
 * Que montrer sur /live ?
 * - salle d'attente tant que le live n'est pas ouvert, POUR TOUT LE MONDE
 *   (équipe comprise) ; seul un compte admin avec ?equipe voit la vidéo ;
 * - réglages illisibles : écran de chargement, puis (après le délai de
 *   secours) salle d'attente avant l'heure prévue, live après — bloquer les
 *   requêtes ne permet pas d'arriver sur le live en avance.
 */
export function liveGate(input: {
  hasSettings: boolean;
  liveOpen: boolean | undefined;
  isAdmin: boolean;
  teamPreview: boolean;
  timedOut: boolean;
  nowMs: number;
  fallbackStartMs: number;
}): LiveGate {
  if (!input.hasSettings) {
    if (!input.timedOut) return "loading";
    return input.nowMs < input.fallbackStartMs ? "waiting" : "live";
  }
  if (input.liveOpen === false) return input.isAdmin && input.teamPreview ? "live" : "waiting";
  return "live";
}
