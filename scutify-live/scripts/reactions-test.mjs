#!/usr/bin/env node
/**
 * Test des réactions Scutify Live (🔥 💰 ❤️ 👍).
 *
 *   npm run reactions-test
 *       Vérification fonctionnelle (limites ACTIVES) : réactions acceptées et
 *       reçues dans le lot de diffusion, plafond par appel, limite par compte,
 *       appel refusé sans session.
 *
 *   npm run reactions-test -- --load --reactors 200 --rate 350 --duration 30
 *       Charge : `rate` appels send_reactions() par seconde répartis sur
 *       `reactors` comptes, et contrôle que les totaux diffusés = totaux
 *       acceptés. 350 appels/s ≈ 4 000 spectateurs dont 35 % tapent sans
 *       arrêt (1 appel / 4 s chacun). Limites par compte et par IP à couper
 *       le temps du test (le script donne le SQL), puis à remettre.
 *
 *       Une seule machine (surtout derrière un proxy) peut saturer avant le
 *       serveur : comparer avec la durée côté serveur dans les logs Supabase
 *       (edge_logs, response.origin_time).
 *
 * Options : --reactors <n> [200] · --rate <n> appels/s [350] ·
 *           --duration <s> [30] · --listeners <n> [3] · --max-p95 <ms> [1500]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { createClient, RealtimeClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { loadEnv, requireEnv } from "./lib/env.mjs";

loadEnv();

const { values: args } = parseArgs({
  options: {
    load: { type: "boolean", default: false },
    reactors: { type: "string", default: "200" },
    rate: { type: "string", default: "350" },
    duration: { type: "string", default: "30" },
    listeners: { type: "string", default: "3" },
    "max-p95": { type: "string", default: "1500" },
  },
});

const REACTORS = Number(args.reactors);
const RATE = Number(args.rate);
const DURATION_S = Number(args.duration);
const LISTENERS = Number(args.listeners);
const MAX_P95 = Number(args["max-p95"]);
const KINDS = ["fire", "money", "heart", "thumbs"];
const CHANNEL = "live-chat";
const CACHE_FILE = ".loadtest-cache.json";

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const REALTIME_URL = `${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const empty = () => ({ fire: 0, money: 0, heart: 0, thumbs: 0 });
const add = (a, b) => {
  for (const k of KINDS) a[k] += b[k] ?? 0;
  return a;
};
const fmt = (c) => KINDS.map((k, i) => `${["🔥", "💰", "❤️", "👍"][i]} ${c[k]}`).join("  ");
const same = (a, b) => KINDS.every((k) => a[k] === b[k]);

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))];
}

let clientCount = 0;
function authClient() {
  clientCount += 1;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `rx-${clientCount}` },
    realtime: { transport: WebSocket },
  });
}

function readCache() {
  try {
    const cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    return cache.url === SUPABASE_URL ? cache : { url: SUPABASE_URL };
  } catch {
    return { url: SUPABASE_URL };
  }
}

/** Session anonyme réutilisée (refresh token) pour épargner la limite horaire. */
async function anonymousSession(refreshToken) {
  const client = authClient();
  if (refreshToken) {
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data.session) return { client, session: data.session };
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`Connexion anonyme impossible : ${error.message}`);
  return { client, session: data.session };
}

/** Spectateur Realtime : additionne les totaux de réactions reçus. */
async function connectListener(token, onReactions) {
  const client = new RealtimeClient(REALTIME_URL, {
    params: { apikey: SUPABASE_KEY },
    accessToken: async () => token,
    transport: WebSocket,
  });
  await client.setAuth();
  const channel = client.channel(CHANNEL, { config: { private: true } });
  channel.on("broadcast", { event: "new_message" }, ({ payload }) => {
    if (payload?.reactions) onReactions(payload.reactions, now());
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("abonnement Realtime trop long")), 15_000);
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(error ?? new Error(status));
      }
    });
  });
  return client;
}

// ----------------------------------------------------------------- setup ---

const probe = authClient();
const { data: settings, error: settingsError } = await probe.from("chat_settings").select("*").eq("id", 1).single();
if (settingsError || settings.reactions_enabled === undefined) {
  console.error("✖ Réglages illisibles ou migration « reactions » absente :", settingsError?.message ?? "");
  process.exit(1);
}
if (!settings.reactions_enabled) {
  console.error("✖ Réactions désactivées : active-les depuis /admin avant le test.");
  process.exit(1);
}

const cache = readCache();
const listenerAuth = await anonymousSession(cache.listener);
cache.listener = listenerAuth.session.refresh_token;
const listenerToken = listenerAuth.session.access_token;

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

// -------------------------------------------------------- fonctionnel ---

if (!args.load) {
  console.log(`\n🧪 Réactions — vérification fonctionnelle (${SUPABASE_URL})\n`);
  if (settings.reaction_user_limit <= 0 || settings.ip_reaction_limit <= 0) {
    console.warn("  ⚠ Limites désactivées : remets-les après un test de charge :");
    console.warn("    update public.chat_settings set reaction_user_limit = 8, ip_reaction_limit = 150 where id = 1;\n");
  }

  const received = empty();
  const listener = await connectListener(listenerToken, (r) => add(received, r));
  const reactor = await anonymousSession(cache.reactors?.[0]);
  cache.reactors = [reactor.session.refresh_token, ...(cache.reactors ?? []).slice(1)];
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  const first = await reactor.client.rpc("send_reactions", { fire: 500, money: 1, heart: 2, thumbs: 1 });
  check(first.data === true && !first.error, "Réactions acceptées", first.error?.message ?? "");

  const deadline = now() + 8_000;
  while (received.fire < 30 && now() < deadline) await sleep(200);
  check(received.fire >= 30 && received.money >= 1 && received.heart >= 2, "Totaux reçus dans le lot diffusé", fmt(received));
  check(received.fire < 500, "Plafond de 30 par type et par appel", `🔥 reçues : ${received.fire}`);

  const zero = await reactor.client.rpc("send_reactions", {});
  check(zero.data === false, "Appel vide ignoré");

  const anonymous = await authClient().rpc("send_reactions", { fire: 1 });
  check(Boolean(anonymous.error), "Refusé sans session", anonymous.error?.message ?? "accepté !");

  if (settings.reaction_user_limit > 0) {
    // Fenêtre de 10 s neuve (fenêtres fixes côté serveur) : aucun appel antérieur.
    await sleep(10_000 - (now() % 10_000) + 300);
    const results = [];
    for (let i = 0; i < settings.reaction_user_limit + 2; i += 1) {
      const { data } = await reactor.client.rpc("send_reactions", { heart: 1 });
      results.push(data === true);
    }
    const accepted = results.filter(Boolean).length;
    check(
      accepted === settings.reaction_user_limit,
      "Limite par compte",
      `${accepted} appels acceptés sur ${results.length} en 10 s (max ${settings.reaction_user_limit})`,
    );
  }

  listener.disconnect();
  console.log(failures === 0 ? "\n✅ Réactions opérationnelles.\n" : `\n❌ ${failures} vérification(s) en échec.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

// --------------------------------------------------------------- charge ---

for (const [name, value] of Object.entries({ REACTORS, RATE, DURATION_S, LISTENERS, MAX_P95 })) {
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`✖ Option invalide : ${name}`);
    process.exit(1);
  }
}
if (settings.reaction_user_limit > 0 || settings.ip_reaction_limit > 0) {
  console.error(
    "✖ Limites de réactions actives : un test depuis une seule machine serait bridé.\n" +
      "  Coupe-les le temps du test (SQL Editor), puis remets-les :\n" +
      "    update public.chat_settings set reaction_user_limit = 0, ip_reaction_limit = 0 where id = 1;\n" +
      "    update public.chat_settings set reaction_user_limit = 8, ip_reaction_limit = 150 where id = 1;",
  );
  process.exit(1);
}

console.log(`\n🧪 Réactions — test de charge : ${RATE} appels/s · ${REACTORS} comptes · ${DURATION_S} s\n`);

const reactors = [];
process.stdout.write("• Sessions…");
for (let i = 0; i < REACTORS; i += 1) {
  const { client, session } = await anonymousSession(cache.reactors?.[i]);
  reactors.push({ client, refreshToken: session.refresh_token });
  if ((i + 1) % 25 === 0) process.stdout.write(`\r• Sessions : ${i + 1}/${REACTORS}`);
}
cache.reactors = reactors.map((r) => r.refreshToken);
writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
console.log(`\r• Sessions : ${REACTORS}/${REACTORS} prêtes`);

let testStart = Infinity;
const listenerTotals = Array.from({ length: LISTENERS }, empty);
const batchTimes = [];
const listenerClients = [];
for (let i = 0; i < LISTENERS; i += 1) {
  listenerClients.push(
    await connectListener(listenerToken, (r, at) => {
      if (at < testStart) return;
      add(listenerTotals[i], r);
      if (i === 0) batchTimes.push(at);
    }),
  );
}
console.log(`• ${LISTENERS} spectateurs abonnés`);
await sleep(4_000); // laisse passer un éventuel lot en cours

const accepted = empty();
const stats = { calls: 0, ok: 0, refused: 0, errors: new Map(), latencies: [], inFlight: 0, maxInFlight: 0 };
let cursor = 0;

async function callOne() {
  const reactor = reactors[cursor];
  cursor = (cursor + 1) % reactors.length;
  const counts = empty();
  const kinds = KINDS.filter(() => Math.random() < 0.5);
  for (const k of kinds.length ? kinds : ["fire"]) counts[k] = 1 + Math.floor(Math.random() * 6);
  stats.calls += 1;
  stats.inFlight += 1;
  stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
  const t = now();
  const { data, error } = await reactor.client.rpc("send_reactions", counts);
  stats.latencies.push(now() - t);
  stats.inFlight -= 1;
  if (error) {
    const key = `${error.code ?? ""} ${error.message}`.trim();
    stats.errors.set(key, (stats.errors.get(key) ?? 0) + 1);
  } else if (data === true) {
    stats.ok += 1;
    add(accepted, counts);
  } else {
    stats.refused += 1;
  }
}

testStart = now();
const end = testStart + DURATION_S * 1000;
const pending = new Set();
let scheduled = 0;
while (now() < end) {
  // Planification sans dérive : rattrape le retard éventuel de la boucle.
  const due = Math.floor(((now() - testStart) / 1000) * RATE);
  while (scheduled < due) {
    scheduled += 1;
    const p = callOne().finally(() => pending.delete(p));
    pending.add(p);
  }
  const elapsed = Math.floor((now() - testStart) / 1000);
  process.stdout.write(`\r• ${elapsed}/${DURATION_S} s · ${stats.calls} appels · en vol ${stats.inFlight}   `);
  await sleep(20);
}
await Promise.all(pending);
const sendSeconds = (now() - testStart) / 1000;
console.log(`\r• Envoi terminé : ${stats.calls} appels en ${sendSeconds.toFixed(1)} s                  `);

// Dernier lot : ≤ intervalle de diffusion (3 s) + cron (1 s).
const drainDeadline = now() + 10_000;
while (!listenerTotals.every((t) => same(t, accepted)) && now() < drainDeadline) await sleep(250);
for (const client of listenerClients) client.disconnect();

const sorted = [...stats.latencies].sort((a, b) => a - b);
const p95 = percentile(sorted, 95);
const gaps = batchTimes.slice(1).map((t, i) => t - batchTimes[i]);

console.log("\n📊 Résultats");
console.log(`  Débit        : ${(stats.calls / sendSeconds).toFixed(0)} appels/s (visé ${RATE}), max ${stats.maxInFlight} en vol`);
console.log(
  `  Latence RPC  : p50 ${percentile(sorted, 50)} ms · p95 ${p95} ms · p99 ${percentile(sorted, 99)} ms · max ${sorted.at(-1)} ms`,
);
console.log(`  Acceptés     : ${stats.ok} · ignorés ${stats.refused} · erreurs ${[...stats.errors.values()].reduce((a, b) => a + b, 0)}`);
for (const [key, count] of stats.errors) console.log(`                 ${count} × ${key}`);
console.log(`  Envoyées     : ${fmt(accepted)}`);
listenerTotals.forEach((t, i) => console.log(`  Reçues (#${i + 1})  : ${fmt(t)}`));
console.log(
  `  Lots         : ${batchTimes.length} · écart moyen ${gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : "—"} ms · max ${gaps.length ? Math.max(...gaps) : "—"} ms`,
);

console.log("");
check(stats.errors.size === 0 && stats.refused === 0, "Aucune erreur ni réaction ignorée");
check(listenerTotals.every((t) => same(t, accepted)), "Totaux diffusés = totaux acceptés (chaque spectateur)");
check(p95 <= MAX_P95, `Latence p95 ≤ ${MAX_P95} ms`, `${p95} ms`);
check(stats.calls / sendSeconds >= RATE * 0.9, "Débit tenu (≥ 90 % du visé)");
console.log(
  "\n  Pense à remettre les limites :\n" +
    "    update public.chat_settings set reaction_user_limit = 8, ip_reaction_limit = 150 where id = 1;",
);
console.log(failures === 0 ? "\n✅ Test de charge réussi.\n" : `\n❌ ${failures} critère(s) en échec.\n`);
process.exit(failures === 0 ? 0 : 1);
