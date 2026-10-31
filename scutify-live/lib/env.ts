/**
 * Variables publiques (inlinées au build par Next.js : chaque accès doit être
 * littéral, `process.env.NEXT_PUBLIC_X`).
 *
 * Aucune clé secrète ici : la SUPABASE_SERVICE_ROLE_KEY n'est utilisée que
 * par les scripts locaux (scripts/create-admin.mjs) et ne doit jamais être
 * préfixée NEXT_PUBLIC_.
 */
const DEFAULT_STREAM_EMBED_URL = "https://streamyard.com/watch/bjJkQR6HBCpX?embed=true";

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copie .env.example vers .env.local et renseigne-la (voir README).`,
    );
  }
  return value.trim();
}

export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  streamEmbedUrl: process.env.NEXT_PUBLIC_STREAM_EMBED_URL?.trim() || DEFAULT_STREAM_EMBED_URL,
};
