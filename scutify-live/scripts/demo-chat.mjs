#!/usr/bin/env node
/**
 * Démo « public en direct » : simule des spectateurs qui écrivent dans le
 * chat (🔥, bonjours, questions…) pour voir le rendu du live et de l'admin.
 *
 *   npm run demo-chat                       # 200 messages, ~90 s, 40 spectateurs
 *   npm run demo-chat -- --messages 300 --duration 120 --viewers 50
 *
 * Utilise la vraie fonction send_message (slow mode, mots-clés, etc. appliqués).
 * Après la démo : « Vider le chat » dans /admin.
 */
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { loadEnv, requireEnv } from "./lib/env.mjs";

loadEnv();

const { values: args } = parseArgs({
  options: {
    messages: { type: "string", default: "200" },
    duration: { type: "string", default: "90" },
    viewers: { type: "string", default: "40" },
  },
});
const TOTAL = Number(args.messages);
const DURATION_S = Number(args.duration);
const VIEWERS = Number(args.viewers);

const URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const PSEUDOS = [
  "Sarah", "Yanis", "Camille_D", "Mehdi", "Julie", "Thomas", "Inès", "Lucas", "Nadia", "Kevin",
  "Emma", "Hugo", "Léa", "Rayan", "Chloé", "Nicolas", "Amira", "Maxime", "Sofia", "Bilal",
  "Manon", "Antoine", "Lina", "Romain", "Aïcha", "Florian", "Clara", "Samir", "Pauline", "Jérémy",
  "Yasmine", "Alexandre", "Océane", "Karim", "Laura", "Mathis", "Sonia", "Dylan", "Elodie", "Adam",
  "Ibrahim", "Margaux", "Théo", "Salomé", "Walid", "Justine", "Enzo", "Myriam", "Quentin", "Zoé",
];

const MESSAGES = [
  "🔥🔥🔥", "🔥", "🔥🔥", "🔥🔥🔥🔥", "Bonjour à tous !", "Bonsoir tout le monde 👋", "Salut l'équipe !",
  "Bonsoir de Marseille 👋", "Coucou de Bruxelles 🇧🇪", "Hello depuis Montréal 🇨🇦", "Bonsoir de Lyon !",
  "Bonjour de Toulouse ☀️", "Salut de Genève 🇨🇭", "Bonsoir depuis Casablanca 🇲🇦", "Quelqu'un de Lille ?",
  "Trop hâte !!", "On entend bien 👌", "Le son est parfait", "Merci Richard !", "Bravo Karine 👏",
  "Bonsoir Mounir !", "Énorme 💪", "C'est top", "Je prends des notes 📝", "Waouh", "Incroyable ce parcours",
  "Ça donne envie !", "Première fois en live, bonjour !", "❤️", "💯", "Let's go 🚀", "Top top top",
  "Merci pour la valeur", "On veut la suite !", "Question : c'est accessible aux débutants ?",
  "Question : il faut combien de budget pour commencer ?", "Je suis dans l'e-commerce depuis 2 ans, ça me parle",
  "Trop fort 🙌", "Merci l'équipe Scutify", "J'adore l'énergie 😄", "C'est exactement ce qu'il me fallait",
  "Je suis prêt(e) 🔥", "Go go go", "Excellent 👍", "Ça fait plaisir de vous voir en live",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

console.log(`\n🎬 Démo chat : ${TOTAL} messages, ${VIEWERS} spectateurs, ~${DURATION_S} s\n`);

const viewers = [];
for (let i = 0; i < VIEWERS; i += 1) {
  const client = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `scutify-demo-${i}` },
  });
  const { error } = await client.auth.signInAnonymously();
  if (error) {
    console.error("✖ Connexion anonyme impossible :", error.message);
    process.exit(1);
  }
  const pseudo = PSEUDOS[i % PSEUDOS.length] + (i >= PSEUDOS.length ? String(i) : "");
  const profile = await client.rpc("set_profile", { pseudo, email: `demo+${i}@example.com` });
  if (profile.error) {
    console.error(`✖ Profil ${pseudo} :`, profile.error.message);
    continue;
  }
  viewers.push({ client, pseudo, nextAt: 0 });
  process.stdout.write(`\r• ${viewers.length}/${VIEWERS} spectateurs connectés`);
}
console.log("\n• C'est parti !\n");

const interval = (DURATION_S * 1000) / TOTAL;
let sent = 0;
let refused = 0;
const reasons = new Map();
const start = Date.now();

for (let n = 0; n < TOTAL; n += 1) {
  // Rythme irrégulier (rafales et accalmies), comme un vrai public.
  await sleep(interval * (0.3 + Math.random() * 1.4));
  const now = Date.now();
  const free = viewers.filter((v) => v.nextAt <= now);
  if (free.length === 0) continue;
  const viewer = pick(free);
  viewer.nextAt = now + 2_300;
  const content = pick(MESSAGES);
  viewer.client.rpc("send_message", { content }).then(({ error }) => {
    if (error) {
      refused += 1;
      reasons.set(error.message, (reasons.get(error.message) ?? 0) + 1);
      if (error.hint === "slow_mode" && error.details) viewer.nextAt = Date.now() + Number(error.details) * 1000 + 300;
    } else {
      sent += 1;
    }
  });
  if (n % 20 === 0) process.stdout.write(`\r  ${sent} envoyés · ${Math.round((Date.now() - start) / 1000)} s`);
}
await sleep(2_000);

console.log(`\r  ${sent} messages envoyés en ${Math.round((Date.now() - start) / 1000)} s, ${refused} refusés`);
for (const [reason, count] of reasons) console.log(`    ${count} × ${reason}`);
console.log("\n✔ Démo terminée. Pense à « Vider le chat » dans /admin.\n");
process.exit(0);
