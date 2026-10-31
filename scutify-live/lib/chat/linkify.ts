export type TextPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'")\]}]+$/;

/**
 * Découpe un texte en segments texte / lien. Seuls les liens http(s)
 * explicites deviennent cliquables (jamais javascript:, data:, …).
 */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let url = match[0];
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    if (trailing) url = url.slice(0, -trailing.length);
    if (start > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, start) });
    if (isSafeHttpUrl(url)) {
      parts.push({ type: "link", value: url, href: url });
    } else {
      parts.push({ type: "text", value: url });
    }
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
}

export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
