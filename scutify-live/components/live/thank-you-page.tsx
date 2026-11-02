"use client";

import { isSafeHttpUrl } from "@/lib/chat/linkify";
import type { ChatSettings } from "@/lib/chat/types";

import { CustomBlock } from "./custom-block";

type Props = {
  /** Bloc « Offre » (affiché ici même s'il était masqué pendant le live). */
  html: string | null;
  settings: ChatSettings | null;
};

/**
 * Fin du live : remerciement + offre. Plus de vidéo, de chat ni de réactions.
 * Sans bloc « Offre », le bouton de l'épingle sert d'appel à l'action.
 */
export function ThankYouPage({ html, settings }: Props) {
  const hasOffer = Boolean(html?.trim());
  const ctaUrl = isSafeHttpUrl(settings?.pinned_url) ? settings?.pinned_url : null;

  return (
    <main
      className="pt-safe fixed inset-x-0 top-0 overflow-y-auto overscroll-contain bg-brand-navy text-white"
      style={{
        height: "var(--app-height, 100dvh)",
        transform: "translate3d(0, var(--app-offset-top, 0px), 0)",
        backgroundImage:
          "radial-gradient(60% 35% at 50% 0%, rgb(102 204 255 / 0.25), transparent 70%), linear-gradient(180deg, #003366 0%, #001a33 100%)",
      }}
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center px-4 pb-10 pt-12 text-center sm:px-6 sm:pt-16">
        <p className="text-5xl" aria-hidden>
          🙏
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">Merci d&apos;avoir été là !</h1>
        <p className="mt-3 max-w-xl text-base text-white/80 sm:text-lg">
          Le live de Karine <span className="text-brand-sky">et</span> Richard est terminé. Merci pour votre énergie et
          vos messages ce soir 🔥
        </p>

        {hasOffer ? (
          <div className="mt-8 w-full text-left">
            <CustomBlock html={html} />
          </div>
        ) : (
          ctaUrl && (
            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center rounded-full border-2 border-white bg-brand-sky px-8 py-4 text-lg font-extrabold text-brand-navy shadow-lg"
            >
              {settings?.pinned_label?.trim() || "Découvrir l'offre"}
            </a>
          )
        )}
      </div>
    </main>
  );
}
