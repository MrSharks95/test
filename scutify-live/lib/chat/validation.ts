import { PSEUDO_MAX_LENGTH, PSEUDO_MIN_LENGTH } from "./constants";

/** Même nettoyage que private.clean_text() côté SQL. */
export function cleanText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\s\p{Cc}]+/gu, " ")
    .trim();
}

const PSEUDO_PATTERN = /^[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ _.'’-]+$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Pré-validation (le serveur reste l'autorité). */
export function validatePseudo(raw: string): string | null {
  const pseudo = cleanText(raw);
  if (pseudo.length < PSEUDO_MIN_LENGTH || pseudo.length > PSEUDO_MAX_LENGTH) {
    return `Ton pseudo doit contenir entre ${PSEUDO_MIN_LENGTH} et ${PSEUDO_MAX_LENGTH} caractères.`;
  }
  if (!PSEUDO_PATTERN.test(pseudo)) {
    return "Ton pseudo ne peut contenir que des lettres, des chiffres, des espaces et . _ - '.";
  }
  return null;
}

export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Ton adresse email n'est pas valide.";
  return null;
}
