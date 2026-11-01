"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useRef } from "react";

import { useNow } from "@/hooks/use-now";
import { countdownParts, formatStartDate, pad2 } from "@/lib/chat/countdown";
import type { ConnectionState } from "@/lib/chat/types";

type Props = {
  /** Début annoncé (ms) ; null = « bientôt ». */
  startsAt: number | null;
  connection: ConnectionState;
  /** Relit l'état public (instantané CDN) : filet si le temps réel a sauté. */
  onCheck: () => void;
  /** Compte équipe : lien discret vers l'aperçu vidéo (jamais montré aux spectateurs). */
  isAdmin?: boolean;
};

/** Après l'heure annoncée, on revérifie toutes les 30-45 s (étalé). */
const CHECK_AFTER_START_MS = 30_000;
/** Avant l'heure : seulement si la connexion temps réel est coupée. */
const CHECK_OFFLINE_MS = 60_000;
const CHECK_JITTER_MS = 15_000;
/** Proposer d'actualiser si le live n'est toujours pas ouvert 5 min après. */
const REFRESH_HINT_AFTER_MS = 5 * 60_000;

/**
 * Salle d'attente : compte à rebours seul (ni vidéo, ni chat, ni réactions).
 * L'ouverture du live arrive en temps réel (settings_updated) et bascule la
 * page sans rechargement ; la relecture périodique n'est qu'un filet.
 */
export function WaitingRoom({ startsAt, connection, onCheck, isAdmin = false }: Props) {
  const now = useNow(true, 1000);
  const parts = startsAt ? countdownParts(startsAt, now) : null;
  const started = startsAt !== null && now >= startsAt;

  const lastCheckRef = useRef(Date.now());
  const nextGapRef = useRef(CHECK_AFTER_START_MS + Math.random() * CHECK_JITTER_MS);
  const onCheckRef = useRef(onCheck);
  useEffect(() => {
    onCheckRef.current = onCheck;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      const isStarted = startsAt !== null && t >= startsAt;
      if (!isStarted && connection === "online") return;
      const base = isStarted ? CHECK_AFTER_START_MS : CHECK_OFFLINE_MS;
      if (t - lastCheckRef.current < Math.max(base, nextGapRef.current)) return;
      lastCheckRef.current = t;
      nextGapRef.current = base + Math.random() * CHECK_JITTER_MS;
      onCheckRef.current();
    }, 5_000);
    return () => clearInterval(id);
  }, [startsAt, connection]);

  const units = parts
    ? [
        ...(parts.days > 0 ? [{ value: parts.days, label: parts.days > 1 ? "jours" : "jour" }] : []),
        { value: parts.hours, label: "heures" },
        { value: parts.minutes, label: "minutes" },
        { value: parts.seconds, label: "secondes" },
      ]
    : [];

  return (
    <main
      className="pt-safe fixed inset-x-0 top-0 flex flex-col items-center justify-center overflow-y-auto bg-brand-navy px-5 text-center text-white"
      style={{
        height: "var(--app-height, 100dvh)",
        transform: "translate3d(0, var(--app-offset-top, 0px), 0)",
        backgroundImage:
          "radial-gradient(60% 45% at 50% 35%, rgb(102 204 255 / 0.22), transparent 70%), linear-gradient(180deg, #003366 0%, #001a33 100%)",
      }}
    >
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
        Karine <span className="text-brand-sky">et</span> Richard
      </h1>

      {parts && !parts.done ? (
        <>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/70 sm:text-base">
            Le live commence dans
          </p>
          <div className="mt-4 flex items-start justify-center gap-2 sm:gap-4" role="timer" aria-live="off">
            {units.map((unit) => (
              <div key={unit.label} className="flex flex-col items-center">
                <span className="grid min-w-[4.25rem] place-items-center rounded-2xl bg-white/10 px-2 py-3 text-4xl font-extrabold tabular-nums ring-1 ring-white/15 sm:min-w-[6.5rem] sm:py-5 sm:text-6xl">
                  {pad2(unit.value)}
                </span>
                <span className="mt-2 text-[11px] font-bold uppercase tracking-wider text-white/60 sm:text-xs">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-8 inline-flex items-center gap-2.5 text-lg font-bold sm:text-2xl">
          <span className="size-2.5 animate-live-pulse rounded-full bg-brand-sky" aria-hidden />
          {started ? "Le live commence dans un instant…" : "Le live va bientôt commencer"}
        </p>
      )}

      {startsAt !== null && (
        <p className="mt-6 text-base font-semibold text-brand-sky sm:text-lg">{formatStartDate(startsAt)}</p>
      )}

      <p className="mt-8 max-w-md text-sm text-white/70">
        Garde cette page ouverte : le live s&apos;affichera automatiquement.
      </p>

      {started && startsAt !== null && now - startsAt > REFRESH_HINT_AFTER_MS && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold ring-1 ring-white/20 transition hover:bg-white/25"
        >
          <RotateCw className="size-4" /> Toujours rien ? Actualiser la page
        </button>
      )}

      {isAdmin && (
        <a
          href="/live?equipe"
          className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-full bg-amber-300 px-3 py-1.5 text-xs font-bold text-brand-navy"
        >
          Équipe : vérifier la vidéo avant l&apos;ouverture →
        </a>
      )}
    </main>
  );
}

/** Écran neutre le temps de savoir si la salle d'attente est active (≈ 1 s). */
export function LiveLoading() {
  return (
    <div
      className="fixed inset-x-0 top-0 grid place-items-center bg-brand-navy"
      style={{ height: "var(--app-height, 100dvh)" }}
      aria-busy="true"
      aria-label="Chargement"
    >
      <span className="size-3 animate-live-pulse rounded-full bg-brand-sky" />
    </div>
  );
}
