"use client";

import { useCallback, useEffect, useRef } from "react";

import type { LiveChat } from "@/hooks/use-live-chat";
import {
  addCounts,
  emptyCounts,
  particlesFor,
  REACTION_KINDS,
  REACTION_SEND_INTERVAL_MS,
  REACTIONS,
  type ReactionKind,
  subtractOwn,
  takeBatch,
  totalOf,
} from "@/lib/chat/reactions";

/** Émojis animés simultanément au maximum (fluidité sur mobile). */
const MAX_PARTICLES = 40;
/** Les totaux arrivent toutes les ~3 s : on les étale pour un flux continu. */
const SPREAD_MS = 2_800;
/** Premier envoi après un appui : regroupe une rafale d'appuis. */
const FIRST_SEND_DELAY_MS = 400;
/** Appuis gardés en attente par type au maximum (auto-clic). */
const MAX_PENDING = 60;
/** Ses propres réactions non retrouvées dans un lot sont oubliées après 10 s. */
const OWN_TTL_MS = 10_000;

/**
 * Réactions du spectateur (une instance pour la page, l'affichage peut se
 * déplacer entre le chat et la vidéo sans perdre les appuis en attente).
 *
 * - appui : émoji animé tout de suite, envoi groupé au plus toutes les 2 s ;
 * - réception : totaux du lot (hors ses propres réactions) animés en continu.
 *
 * Les émojis sont créés directement dans le DOM (aucun rendu React par émoji).
 */
export function useReactions(chat: LiveChat) {
  const { onReactions, sendReactions } = chat;
  const layerRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef(emptyCounts());
  const ownRef = useRef({ counts: emptyCounts(), at: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef(0);
  const disposedRef = useRef(false);

  const enabled = chat.phase === "ready" && Boolean(chat.userId) && chat.settings?.reactions_enabled !== false;

  const setLayer = useCallback((element: HTMLElement | null) => {
    layerRef.current = element;
  }, []);

  const spawn = useCallback((kind: ReactionKind, own: boolean) => {
    const layer = layerRef.current;
    if (!layer || document.hidden || layer.childElementCount >= MAX_PARTICLES) return;
    const index = REACTION_KINDS.indexOf(kind);
    const reaction = REACTIONS[index];
    if (!reaction) return;

    const duration = 2.1 + Math.random() * 0.9;
    const particle = document.createElement("span");
    particle.className = "reaction-particle";
    particle.textContent = reaction.emoji;
    const x = ((index + 0.5) / REACTIONS.length) * 100 + (Math.random() - 0.5) * (own ? 8 : 20);
    particle.style.setProperty("--x", `${x}%`);
    particle.style.setProperty("--rise", `${150 + Math.random() * 110}px`);
    particle.style.setProperty("--sway", `${(Math.random() - 0.5) * 36}px`);
    particle.style.setProperty("--drift", `${(Math.random() - 0.5) * 60}px`);
    particle.style.setProperty("--dur", `${duration}s`);
    particle.style.setProperty("--size", `${own ? 1.9 : 1.3 + Math.random() * 0.5}rem`);
    const remove = () => particle.remove();
    particle.addEventListener("animationend", remove, { once: true });
    setTimeout(remove, duration * 1000 + 500); // filet si l'animation ne se termine pas
    layer.appendChild(particle);
  }, []);

  // Totaux reçus avec chaque lot.
  useEffect(
    () =>
      onReactions((received) => {
        const own = ownRef.current;
        if (Date.now() - own.at > OWN_TTL_MS) own.counts = emptyCounts();
        const { others, remainingOwn } = subtractOwn(received, own.counts);
        own.counts = remainingOwn;
        if (document.hidden || !layerRef.current) return;
        for (const kind of REACTION_KINDS) {
          const count = particlesFor(others[kind]);
          for (let i = 0; i < count; i += 1) {
            setTimeout(() => spawn(kind, false), Math.random() * SPREAD_MS);
          }
        }
      }),
    [onReactions, spawn],
  );

  const scheduleSend = useCallback(() => {
    if (timerRef.current) return;
    const send = async () => {
      const { batch, rest } = takeBatch(pendingRef.current);
      pendingRef.current = rest;
      lastSentRef.current = Date.now();
      if (totalOf(batch) > 0 && (await sendReactions(batch))) {
        ownRef.current = { counts: addCounts(ownRef.current.counts, batch), at: Date.now() };
      }
      // Pas d'envoi concurrent : le minuteur reste « occupé » pendant l'appel.
      timerRef.current =
        !disposedRef.current && totalOf(pendingRef.current) > 0
          ? setTimeout(() => void send(), Math.max(0, lastSentRef.current + REACTION_SEND_INTERVAL_MS - Date.now()))
          : null;
    };
    const wait = Math.max(FIRST_SEND_DELAY_MS, lastSentRef.current + REACTION_SEND_INTERVAL_MS - Date.now());
    timerRef.current = setTimeout(() => void send(), wait);
  }, [sendReactions]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  const tap = useCallback(
    (kind: ReactionKind) => {
      if (!enabled) return;
      spawn(kind, true);
      pendingRef.current = { ...pendingRef.current, [kind]: Math.min(pendingRef.current[kind] + 1, MAX_PENDING) };
      scheduleSend();
    },
    [enabled, spawn, scheduleSend],
  );

  return { enabled, tap, setLayer };
}

export type LiveReactions = ReturnType<typeof useReactions>;
