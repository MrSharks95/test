"use client";

import { useEffect } from "react";

/**
 * Expose la taille du viewport VISIBLE en variables CSS :
 *   --app-height     : hauteur visible (se réduit quand le clavier s'ouvre)
 *   --app-offset-top : décalage du viewport visible (iOS fait « glisser » la
 *                      page vers le haut à l'ouverture du clavier)
 *
 * Android (Chrome) redimensionne déjà la page grâce à
 * `interactive-widget=resizes-content` ; iOS Safari non : c'est l'API
 * visualViewport qui permet de garder le champ de saisie collé au clavier.
 */
export function useVisualViewportVars() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let frame = 0;
    // Hauteur maximale observée pour la largeur courante : sert à détecter le
    // clavier (hauteur visible nettement plus petite que d'habitude).
    let baseline = { width: 0, height: 0 };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = vv ? vv.height : window.innerHeight;
        const width = vv ? vv.width : window.innerWidth;
        const offsetTop = vv ? Math.max(0, vv.offsetTop) : 0;
        if (Math.abs(width - baseline.width) > 40) baseline = { width, height };
        baseline.height = Math.max(baseline.height, height);
        const keyboardOpen = height < baseline.height * 0.75;
        root.style.setProperty("--app-height", `${Math.round(height)}px`);
        root.style.setProperty("--app-offset-top", `${Math.round(offsetTop)}px`);
        root.dataset.keyboard = keyboardOpen ? "open" : "closed";
      });
    };

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--app-offset-top");
      delete root.dataset.keyboard;
    };
  }, []);
}

/** Ajoute une classe sur <html> le temps du montage (ex. verrouillage du scroll). */
export function useHtmlClass(className: string) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(className);
    return () => root.classList.remove(className);
  }, [className]);
}
