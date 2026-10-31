#!/usr/bin/env node
/**
 * Test de charge Scutify Live — à lancer AVANT chaque live.
 *
 * Simule N spectateurs connectés au canal Realtime privé "live-chat" et un
 * débit de messages envoyés via la vraie fonction send_message(), puis mesure
 * la livraison (taux, latence) et les déconnexions.
 *
 *   npm run load-test                                  # 4000 clients, 5 msg/s, 60 s
 *   npm run load-test -- --clients 300 --rate 5 --duration 120
 *
 * Options :
 *   --clients <n>    spectateurs simulés (connexions WebSocket)   [4000]
 *   --rate <n>       messages envoyés par seconde                 [5]
 *   --duration <s>   durée de la phase d'envoi                    [60]
 *   --senders <n>    comptes émetteurs (auto selon le slow mode)
 *   --ramp <n>       nouvelles connexions par seconde             [100]
 *   --max-p95 <ms>   latence p95 maximale acceptée                [4000]
 *
 * Les messages étant diffusés par lots (≤ 1 diffusion / 2 s), la latence
 * attendue est de 0 à ~3 s. 4000 connexions depuis une seule machine :
 * augmenter la limite de fichiers ouverts avant (`ulimit -n 10000`).
 *
 * Prérequis : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY dans
 * .env.local, connexions anonymes activées, chat ouvert, liens indifférents.
 * Les messages de test sont préfixés « 🧪 Test de charge » : videz le chat
 * depuis /admin après le test.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { createClient, RealtimeClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { loadEnv, requireEnv } from "./lib/env.mjs";

loadEnv();

const { values: args } = parseArgs({
  options: {
    clients: { type: "string", default: "4000" },
    rate: { type: "string", default: "5" },
    duration: { type: "string", default: "60" },
    senders: { type: "string" },
    ramp: { type: "string", default: "100" },
    "max-p95": { type: "string", default: "4000" },
  },
});

const CLIENTS = Number(args.clients);
const RATE = Number(args.rate);
const DURATION_S = Number(args.duration);
const RAMP = Number(args.ramp);
const MAX_P95 = Number(args["max-p95"]);
const CHANNEL = "live-chat";
const CACHE_FILE = ".loadtest-cache.json";
const RUN_ID = Math.random().toString(36).slice(2, 8);

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

for (const [name, value] of Object.entries({ CLIENTS, RATE, DURATION_S, RAMP, MAX_P95 })) {
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`✖ Option invalide : ${name}`);
    process.exit(1);
  }
}

// ----------------------------------------------------------------- utils ---

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function fmtMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : "—";
}

let authClientCount = 0;
function authClient() {
  authClientCount += 1;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `scutify-loadtest-${authClientCount}`,
    },
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

/**
 * Réutilise une session anonyme mise en cache (refresh token) pour ne pas
 * consommer la limite « anonymous sign-ins / heure » à chaque essai.
 */
async function anonymousSession(refreshToken) {
  const client = authClient();
  if (refreshToken) {
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data.session) return { client, session: data.session };
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    const hint =
      error.status === 429
        ? " → limite de connexions anonymes atteinte : augmente-la dans Supabase (Authentication > Rate Limits) ou réessaie plus tard."
        : error.message.includes("Anonymous")
          ? " → active les connexions anonymes (Authentication > Sign In / Providers > Anonymous)."
          : "";
    throw new Error(`Connexion anonyme impossible : ${error.message}${hint}`);
  }
  return { client, session: data.session };
}

// ----------------------------------------------------------------- setup ---

console.log(`\n🧪 Test de charge Scutify Live — run ${RUN_ID}`);
console.log(`   ${CLIENTS} spectateurs · ${RATE} msg/s · ${DURATION_S} s · ${SUPABASE_URL}\n`);

const probe = authClient();
const { data: settings, error: settingsError } = await probe
  .from("chat_settings")
  .select("chat_enabled,slow_mode_seconds")
  .eq("id", 1)
  .single();
if (settingsError) {
  console.error("✖ Lecture de chat_settings impossible :", settingsError.message);
  console.error("  La migration a-t-elle été exécutée ?");
  process.exit(1);
}
if (!settings.chat_enabled) {
  console.error("✖ Le chat est fermé : ouvre-le depuis /admin avant le test.");
  process.exit(1);
}

const interval = Math.max(settings.slow_mode_seconds, 2);
// Marge de 60 % : couvre l'aller-retour réseau de chaque envoi.
const SENDERS = args.senders ? Number(args.senders) : Math.ceil(RATE * interval * 1.6);
console.log(`• Slow mode : ${settings.slow_mode_seconds || "off"} (intervalle mini ${interval} s) → ${SENDERS} comptes émetteurs`);

const cache = readCache();

// Un seul utilisateur anonyme suffit pour tous les spectateurs : chaque
// spectateur simulé ouvre sa propre connexion WebSocket avec ce JWT.
const listenerAuth = await anonymousSession(cache.listener);
const listenerToken = listenerAuth.session.access_token;
cache.listener = listenerAuth.session.refresh_token;

const senders = [];
for (let i = 0; i < SENDERS; i += 1) {
  const { client, session } = await anonymousSession(cache.senders?.[i]);
  const label = String(i + 1).padStart(2, "0");
  const { error } = await client.rpc("set_profile", { pseudo: `Charge-${label}`, email: `loadtest+${label}@example.com` });
  if (error) {
    console.error(`✖ Profil émetteur ${label} impossible :`, error.message);
    process.exit(1);
  }
  senders.push({ client, refreshToken: session.refresh_token, nextAllowedAt: 0 });
}
cache.senders = senders.map((s) => s.refreshToken);
writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
console.log(`• ${SENDERS} émetteurs prêts`);

// ----------------------------------------------------------- spectateurs ---

const stats = {
  subscribed: 0,
  disconnects: 0,
  errorSamples: new Map(),
  sent: 0,
  sendErrors: new Map(),
  rpcLatencies: [],
  deliveries: 0,
  // Livraisons attendues = spectateurs abonnés au moment de chaque envoi.
  expected: 0,
  batches: 0,
  deliveryLatencies: [],
  skipped: 0,
};
const sentAt = new Map();
const listeners = [];
let testRunning = false;

function recordError(kind, error) {
  const key = `${kind}: ${error?.message ?? error ?? "?"}`;
  stats.errorSamples.set(key, (stats.errorSamples.get(key) ?? 0) + 1);
}

// Client Realtime seul (sans auth/REST) : léger, une connexion WebSocket par
// spectateur simulé.
const REALTIME_URL = `${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1`;

async function connectListener(index) {
  const client = new RealtimeClient(REALTIME_URL, {
    params: { apikey: SUPABASE_KEY },
    accessToken: async () => listenerToken,
    transport: WebSocket,
  });
  // Le JWT doit être transmis AVANT le join, sinon la 1re tentative part avec
  // la clé anon et est refusée par la policy (canal privé).
  await client.setAuth();
  const state = { client, subscribed: false, everSubscribed: false };
  const channel = client.channel(CHANNEL, { config: { private: true } });

  channel.on("broadcast", { event: "new_message" }, ({ payload }) => {
    const batch = Array.isArray(payload?.messages) ? payload.messages : [payload];
    const receivedAt = now();
    if (index === 0) stats.batches += 1;
    for (const message of batch) {
      const match = /\[([a-z0-9]+):(\d+)\]$/.exec(message?.content ?? "");
      if (!match || match[1] !== RUN_ID) continue;
      const sent = sentAt.get(Number(match[2]));
      if (sent === undefined) continue;
      stats.deliveries += 1;
      stats.deliveryLatencies.push(receivedAt - sent);
    }
  });

  channel.subscribe((status, error) => {
    if (status === "SUBSCRIBED") {
      state.subscribed = true;
      if (!state.everSubscribed) {
        state.everSubscribed = true;
        stats.subscribed += 1;
      }
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      if (state.subscribed && testRunning) stats.disconnects += 1;
      state.subscribed = false;
      recordError(status, error);
    }
  });

  state.channel = channel;
  listeners.push(state);
}

console.log(`• Connexion de ${CLIENTS} spectateurs (${RAMP}/s)…`);
const rampStart = now();
for (let i = 0; i < CLIENTS; i += 1) {
  void connectListener(i).catch((error) => {
    recordError("connexion", error);
    if (error?.code === "EMFILE") {
      console.error("\n✖ Trop de fichiers ouverts : lance `ulimit -n 10000` puis relance le test.");
      process.exit(1);
    }
  });
  if ((i + 1) % RAMP === 0) {
    process.stdout.write(`\r  ${i + 1}/${CLIENTS} lancés, ${stats.subscribed} abonnés`);
    await sleep(1000);
  }
}

const joinDeadline = now() + 30_000;
while (stats.subscribed < CLIENTS && now() < joinDeadline) {
  process.stdout.write(`\r  ${CLIENTS}/${CLIENTS} lancés, ${stats.subscribed} abonnés   `);
  await sleep(500);
}
const connectedAtStart = listeners.filter((l) => l.subscribed).length;
console.log(`\r  ${connectedAtStart}/${CLIENTS} abonnés en ${((now() - rampStart) / 1000).toFixed(1)} s          `);

// ---------------------------------------------------------------- envoi ---

console.log(`• Envoi : ${RATE} msg/s pendant ${DURATION_S} s…`);
testRunning = true;
let seq = 0;
let senderCursor = 0;

async function sendOne() {
  const t = now();
  let sender = null;
  for (let k = 0; k < senders.length; k += 1) {
    const candidate = senders[(senderCursor + k) % senders.length];
    if (candidate.nextAllowedAt <= t) {
      sender = candidate;
      senderCursor = (senderCursor + k + 1) % senders.length;
      break;
    }
  }
  if (!sender) {
    stats.skipped += 1;
    return;
  }

  seq += 1;
  const id = seq;
  sender.nextAllowedAt = Number.POSITIVE_INFINITY; // réservé jusqu'à la réponse
  sentAt.set(id, t);
  const audience = listeners.filter((l) => l.subscribed).length;
  const { error } = await sender.client.rpc("send_message", {
    content: `🧪 Test de charge #${id} [${RUN_ID}:${id}]`,
  });
  stats.rpcLatencies.push(now() - t);
  // L'intervalle anti-flood court à partir de l'enregistrement côté serveur,
  // donc de la réponse (et non de l'envoi) : évite de faux refus si la
  // machine de test est chargée.
  sender.nextAllowedAt = now() + interval * 1000 + 150;
  if (error) {
    sentAt.delete(id);
    const key = error.hint ? `${error.hint} — ${error.message}` : error.message;
    stats.sendErrors.set(key, (stats.sendErrors.get(key) ?? 0) + 1);
    if (error.hint === "slow_mode" && error.details) {
      sender.nextAllowedAt = now() + Number(error.details) * 1000 + 150;
    }
  } else {
    stats.sent += 1;
    stats.expected += audience;
  }
}

const inflight = new Set();
const sendStart = now();
let launched = 0;
// Planification sans dérive : à chaque tick, on rattrape le nombre d'envois
// dû depuis le début (un setInterval simple prend du retard quand la machine
// de test gère des milliers de connexions).
const sendTimer = setInterval(() => {
  const due = Math.floor(((now() - sendStart) / 1000) * RATE) - launched;
  for (let k = 0; k < due; k += 1) {
    launched += 1;
    const p = sendOne().finally(() => inflight.delete(p));
    inflight.add(p);
  }
}, 50);

const progressTimer = setInterval(() => {
  const elapsed = Math.round((now() - sendStart) / 1000);
  const connected = listeners.filter((l) => l.subscribed).length;
  const expected = stats.expected;
  const ratio = expected ? ((stats.deliveries / expected) * 100).toFixed(1) : "—";
  const p95 = percentile([...stats.deliveryLatencies].sort((a, b) => a - b), 95);
  console.log(
    `  t=${String(elapsed).padStart(3)}s · connectés ${connected}/${CLIENTS} · envoyés ${stats.sent} · livrés ${ratio}% · p95 ${fmtMs(p95)}`,
  );
}, 5000);

await sleep(DURATION_S * 1000);
clearInterval(sendTimer);
await Promise.allSettled([...inflight]);
console.log("• Fin des envois, attente des dernières livraisons (5 s)…");
await sleep(5000);
clearInterval(progressTimer);
testRunning = false;

// -------------------------------------------------------------- rapport ---

const connectedAtEnd = listeners.filter((l) => l.subscribed).length;
const expected = stats.expected;
const deliveryRatio = expected ? stats.deliveries / expected : 0;
const delivery = [...stats.deliveryLatencies].sort((a, b) => a - b);
const rpc = [...stats.rpcLatencies].sort((a, b) => a - b);
const sendErrorCount = [...stats.sendErrors.values()].reduce((a, b) => a + b, 0);
const achievedRate = stats.sent / DURATION_S;
// Chaque diffusion (lot) compte une fois par spectateur dans le quota Realtime.
const batchesPerSecond = stats.batches / (DURATION_S + 5);
const eventsPerSecond = batchesPerSecond * connectedAtStart;

console.log("\n──────────────── Rapport ────────────────");
console.log(`Spectateurs abonnés      ${connectedAtStart}/${CLIENTS} (fin : ${connectedAtEnd}, jamais connectés : ${CLIENTS - stats.subscribed})`);
console.log(`Déconnexions pendant test ${stats.disconnects}`);
console.log(`Messages envoyés         ${stats.sent} (${achievedRate.toFixed(2)} msg/s, erreurs : ${sendErrorCount}, non envoyés faute d'émetteur libre : ${stats.skipped})`);
console.log(`Latence send_message     p50 ${fmtMs(percentile(rpc, 50))} · p95 ${fmtMs(percentile(rpc, 95))} · max ${fmtMs(rpc.at(-1))}`);
console.log(`Livraisons               ${stats.deliveries}/${expected} (${(deliveryRatio * 100).toFixed(2)} %)`);
console.log(`Latence de livraison     p50 ${fmtMs(percentile(delivery, 50))} · p95 ${fmtMs(percentile(delivery, 95))} · p99 ${fmtMs(percentile(delivery, 99))} · max ${fmtMs(delivery.at(-1))}`);
console.log(`Diffusions (lots)        ${stats.batches} (${batchesPerSecond.toFixed(2)}/s, ${stats.batches ? (stats.sent / stats.batches).toFixed(1) : "—"} messages par lot)`);
console.log(`Charge Realtime estimée  ≈ ${Math.round(eventsPerSecond)} événements/s délivrés (à comparer au quota du plan)`);

if (stats.sendErrors.size > 0) {
  console.log("\nErreurs d'envoi :");
  for (const [message, count] of stats.sendErrors) console.log(`  ${count} × ${message}`);
}
if (stats.errorSamples.size > 0) {
  console.log("\nÉvénements de canal :");
  for (const [message, count] of [...stats.errorSamples].slice(0, 10)) console.log(`  ${count} × ${message}`);
}

const p95 = percentile(delivery, 95);
// Tolérances réalistes : sur des milliers de connexions réelles, quelques
// coupures isolées (reconnectées automatiquement) sont normales.
const attempts = stats.sent + sendErrorCount + stats.skipped;
const failedSends = sendErrorCount + stats.skipped;
const checks = [
  [connectedAtStart >= CLIENTS * 0.995, `≥ 99,5 % des spectateurs connectés (${connectedAtStart}/${CLIENTS})`],
  [stats.disconnects <= CLIENTS * 0.005, `déconnexions ≤ 0,5 % (${stats.disconnects})`],
  [failedSends <= Math.max(1, attempts * 0.01), `envois en échec ≤ 1 % (${failedSends}/${attempts})`],
  [achievedRate >= RATE * 0.95, `débit atteint (${achievedRate.toFixed(2)}/${RATE} msg/s)`],
  [deliveryRatio >= 0.995, `≥ 99,5 % de livraisons (${(deliveryRatio * 100).toFixed(2)} %)`],
  [Number.isFinite(p95) && p95 <= MAX_P95, `latence p95 ≤ ${MAX_P95} ms (${fmtMs(p95)})`],
];
const [connectedOk, disconnectsOk, , , deliveryOk] = checks.map(([ok]) => ok);

console.log("\nVérifications :");
for (const [ok, label] of checks) console.log(`  ${ok ? "✔" : "✖"} ${label}`);

const passed = checks.every(([ok]) => ok);
console.log(passed ? "\n✅ SUCCÈS — la configuration tient la charge.\n" : "\n❌ ÉCHEC — voir README > Test de charge.\n");
if (!connectedOk) {
  console.log(
    "Piste : quota Realtime « connexions simultanées » atteint (Free : 200, Pro : 500, Pro sans spend cap : 10 000).\n" +
      "Vérifie les logs Realtime du projet (ConnectionRateLimitReached / too_many_connections).\n",
  );
}
if (!disconnectsOk || !deliveryOk) {
  console.log(
    "Piste : quota Realtime « messages par seconde » (MessagePerSecondRateLimitReached / tenant_events).\n" +
      `Chaque diffusion compte une fois PAR spectateur : ≈ ${Math.round(CLIENTS / 2)} événements/s avec des lots toutes les 2 s\n` +
      "(Free : 100/s, Pro : 500/s, Pro sans spend cap : 2 500/s). Voir README > Capacité.\n",
  );
}
console.log("Pense à « Vider le chat » depuis /admin pour retirer les messages de test.\n");

// ------------------------------------------------------------- nettoyage ---

await Promise.allSettled(listeners.map((l) => l.client.removeAllChannels()));
for (const l of listeners) l.client.disconnect();
if (existsSync(CACHE_FILE)) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
process.exit(passed ? 0 : 1);
