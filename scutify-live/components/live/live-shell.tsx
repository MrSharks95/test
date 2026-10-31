"use client";

import { useHtmlClass, useVisualViewportVars } from "@/hooks/use-visual-viewport";
import { useLiveChat } from "@/hooks/use-live-chat";
import { publicEnv } from "@/lib/env";

import { ChatPanel } from "./chat-panel";
import { VideoPlayer } from "./video-player";

/**
 * Mise en page :
 * - mobile portrait : vidéo collée en haut, chat dessous sur toute la hauteur
 *   restante, champ de saisie collé en bas (au-dessus du clavier) ;
 * - mobile paysage : vidéo à gauche, chat à droite ;
 * - desktop (lg) : vidéo ~70 % à gauche, chat pleine hauteur à droite.
 *
 * Le conteneur racine suit le viewport VISIBLE (--app-height /
 * --app-offset-top), ce qui garde le champ de saisie au-dessus du clavier
 * sur iOS comme sur Android.
 */
export function LiveShell() {
  useVisualViewportVars();
  useHtmlClass("live-lock");
  const chat = useLiveChat({ mode: "viewer" });

  return (
    <div
      className="pt-safe fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-brand-navy pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] land:flex-row lg:flex-row"
      style={{
        height: "var(--app-height, 100dvh)",
        transform: "translate3d(0, var(--app-offset-top, 0px), 0)",
      }}
    >
      <section className="shrink-0 bg-black land:flex land:min-w-0 land:flex-1 land:items-center lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:bg-brand-navy">
        <header className="hidden h-16 shrink-0 items-center gap-3 px-8 text-white lg:flex">
          <span className="text-xl font-extrabold tracking-tight">
            Scutify <span className="text-brand-sky">Live</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-sky px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-brand-navy">
            <span className="size-1.5 animate-live-pulse rounded-full bg-brand-navy" aria-hidden />
            En direct
          </span>
        </header>
        <div className="w-full land:flex land:justify-center lg:flex lg:flex-1 lg:items-center lg:justify-center lg:px-8 lg:pb-8">
          <VideoPlayer
            src={publicEnv.streamEmbedUrl}
            className="live-video mx-auto max-w-[calc(var(--app-height,100dvh)*0.45*16/9)] land:max-w-[calc(var(--app-height,100dvh)*16/9)] lg:max-w-[calc((var(--app-height,100dvh)-8rem)*16/9)] lg:rounded-2xl lg:shadow-2xl lg:ring-1 lg:ring-white/10"
          />
        </div>
      </section>

      <aside className="flex min-h-0 flex-1 flex-col bg-white land:w-[42%] land:flex-none lg:w-[30%] lg:min-w-[340px] lg:max-w-[480px] lg:flex-none">
        <ChatPanel chat={chat} />
      </aside>
    </div>
  );
}
