import type { Locale } from "@/lib/i18n/proxy";
import type { WithdrawalItem } from "@/lib/withdrawal/types";

/**
 * Pure email rendering: `{{variable}}` interpolation plus helpers to build the
 * items list and format dates. Scalar values are HTML-escaped by the caller;
 * `items` is pre-rendered safe HTML.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replace every {{key}} with its mapped value (unmatched keys → empty). */
export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : "",
  );
}

export function buildItemsHtml(items: WithdrawalItem[], locale: Locale): string {
  if (items.length === 0) {
    return `<p>${locale === "fr" ? "Aucun article précisé." : "No item specified."}</p>`;
  }
  const lis = items
    .map((it) => `<li>${escapeHtml(it.title)} × ${it.quantity}</li>`)
    .join("");
  return `<ul>${lis}</ul>`;
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

/** French-speaking destinations get the FR email; everything else EN; default FR. */
export function localeForCountry(country: string | null): Locale {
  const fr = ["FR", "BE", "LU", "MC", "CH"];
  if (!country) return "fr";
  return fr.includes(country.toUpperCase()) ? "fr" : "en";
}
