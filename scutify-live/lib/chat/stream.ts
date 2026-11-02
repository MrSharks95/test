/**
 * Lien StreamYard : accepte le code d'intégration complet (<div><iframe…>)
 * ou un simple lien, et renvoie l'URL d'intégration normalisée.
 */
const STREAMYARD_RE = /https:\/\/streamyard\.com\/watch\/([A-Za-z0-9_-]{6,40})/;

export function parseStreamyardEmbed(input: string | null | undefined): string | null {
  const match = STREAMYARD_RE.exec(input?.trim() ?? "");
  return match ? `https://streamyard.com/watch/${match[1]}?embed=true` : null;
}

/** Identifiant de la diffusion (ex. « 4XgFVqbD93jc »), pour l'affichage. */
export function streamyardId(url: string | null | undefined): string | null {
  return STREAMYARD_RE.exec(url ?? "")?.[1] ?? null;
}
