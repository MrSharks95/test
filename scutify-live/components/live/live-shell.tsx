"use client";

import { ChevronDown, MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { useHtmlClass, useVisualViewportVars } from "@/hooks/use-visual-viewport";
import { useLiveChat } from "@/hooks/use-live-chat";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

import { ChatPanel } from "./chat-panel";
import { PinnedMessage } from "./pinned-message";
import { VideoPlayer } from "./video-player";

/**
 * Mise en page :
 * - mobile portrait : vidéo collée en haut, chat dessous sur toute la hauteur
 *   restante, champ de saisie collé en bas (au-dessus du clavier) ;
 * - téléphone / tablette en paysage : priorité au live, vidéo plein écran,
 *   chat juste en dessous (défilement, bouton « Chat ») ;
 * - desktop (lg) : vidéo ~74 % à gauche, chat pleine hauteur à droite ;
 * - chat fermé par l'équipe : chat MASQUÉ, la vidéo prend tout l'écran (le
 *   message épinglé reste affiché sous la vidéo). Les messages continuent
 *   d'arriver en arrière-plan : à la réouverture, le fil est à jour.
 *
 * Le conteneur racine suit le viewport VISIBLE (--app-height /
 * --app-offset-top), ce qui garde le champ de saisie au-dessus du clavier
 * sur iOS comme sur Android.
 */
export function LiveShell() {
  useVisualViewportVars();
  useHtmlClass("live-lock");
  const chat = useLiveChat({ mode: "viewer" });
  // L'équipe garde le chat visible (elle peut écrire même chat fermé).
  const chatHidden = chat.phase === "ready" && chat.settings?.chat_enabled === false && !chat.isAdmin;
  const hasPinned = Boolean(chat.settings?.pinned_message || chat.settings?.pinned_url);
  const { resume } = chat;
  const rootRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);

  // Largeur max de la scène (vidéo + bannière) : la vidéo 16:9 doit tenir en
  // hauteur avec l'en-tête desktop et, le cas échéant, la bannière épinglée.
  const stageWidth = chatHidden
    ? hasPinned
      ? "max-w-[calc((var(--app-height,100dvh)-6rem)*16/9)] lg:max-w-[calc((var(--app-height,100dvh)-12rem)*16/9)] touchland:max-w-[calc((var(--app-height,100dvh)-3.5rem)*16/9)]"
      : "max-w-[calc(var(--app-height,100dvh)*16/9)] lg:max-w-[calc((var(--app-height,100dvh)-8rem)*16/9)] touchland:max-w-[calc(var(--app-height,100dvh)*16/9)]"
    : hasPinned
      ? "max-w-[calc(var(--app-height,100dvh)*0.45*16/9)] lg:max-w-[calc((var(--app-height,100dvh)-12rem)*16/9)] touchland:max-w-[calc((var(--app-height,100dvh)-3.5rem)*16/9)]"
      : "max-w-[calc(var(--app-height,100dvh)*0.45*16/9)] lg:max-w-[calc((var(--app-height,100dvh)-8rem)*16/9)] touchland:max-w-[calc(var(--app-height,100dvh)*16/9)]";
  const scrollToChat = () => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToLive = () => rootRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  // À la réouverture, le fil repart en bas (pas en pause).
  useEffect(() => {
    if (chatHidden) resume();
  }, [chatHidden, resume]);

  return (
    <div
      ref={rootRef}
      className="pt-safe fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-brand-navy pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:flex-row touchland:snap-y touchland:snap-mandatory touchland:flex-col touchland:overflow-y-auto"
      style={{
        height: "var(--app-height, 100dvh)",
        transform: "translate3d(0, var(--app-offset-top, 0px), 0)",
      }}
    >
      <section
        className={cn(
          "relative bg-black lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:bg-brand-navy",
          "touchland:flex touchland:min-h-[var(--app-height,100dvh)] touchland:shrink-0 touchland:snap-start touchland:flex-col touchland:justify-center touchland:bg-black",
          chatHidden ? "flex min-h-0 flex-1 flex-col" : "shrink-0",
        )}
      >
        <header className="hidden h-16 shrink-0 items-center gap-3 px-8 text-white lg:flex touchland:hidden">
          <span className="text-xl font-extrabold tracking-tight">
            Scutify <span className="text-brand-sky">Live</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-sky px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-brand-navy">
            <span className="size-1.5 animate-live-pulse rounded-full bg-brand-navy" aria-hidden />
            En direct
          </span>
        </header>
        <div
          className={cn(
            "w-full lg:flex lg:flex-1 lg:items-center lg:justify-center lg:px-8 lg:pb-8 touchland:block touchland:flex-none touchland:p-0",
            chatHidden && "flex min-h-0 flex-1 items-center justify-center",
          )}
        >
          <div className={cn("live-video mx-auto w-full", stageWidth)}>
            <VideoPlayer
              src={publicEnv.streamEmbedUrl}
              className="lg:rounded-2xl lg:shadow-2xl lg:ring-1 lg:ring-white/10 touchland:rounded-none touchland:shadow-none touchland:ring-0"
            />
            {/* Message épinglé en bannière sous la vidéo (masqué clavier ouvert). */}
            <PinnedMessage
              settings={chat.settings}
              className="live-pinned lg:mt-3 lg:rounded-xl lg:bg-white/10 lg:ring-1 lg:ring-white/15 touchland:mt-0 touchland:rounded-none touchland:bg-brand-navy touchland:ring-0"
            />
          </div>
        </div>
        {!chatHidden && (
          <button
            type="button"
            onClick={scrollToChat}
            className="absolute bottom-4 right-4 z-10 hidden items-center gap-1.5 rounded-full bg-brand-sky px-4 py-2 text-sm font-bold text-brand-navy shadow-lg touchland:inline-flex"
          >
            <MessageCircle className="size-4" /> Chat <ChevronDown className="size-4" />
          </button>
        )}
      </section>

      {!chatHidden && (
        <aside
          ref={chatRef}
          className="flex min-h-0 flex-1 flex-col bg-white lg:w-[26%] lg:min-w-[320px] lg:max-w-[400px] lg:flex-none touchland:h-[var(--app-height,100dvh)] touchland:w-full touchland:min-w-0 touchland:max-w-none touchland:flex-none touchland:snap-start"
        >
          <ChatPanel chat={chat} onBackToLive={scrollToLive} />
        </aside>
      )}
    </div>
  );
}
