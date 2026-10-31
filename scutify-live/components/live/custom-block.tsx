"use client";

import DOMPurify from "dompurify";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

let hookInstalled = false;

/**
 * Nettoie le HTML fourni par l'équipe : pas de scripts, d'iframes, de
 * formulaires ni de gestionnaires d'événements ; liens http(s)/mailto/tel
 * uniquement, ouverts dans un nouvel onglet. Les styles en ligne sont gardés.
 */
export function sanitizeCustomHtml(html: string): string {
  if (typeof window === "undefined") return "";
  if (!hookInstalled) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    hookInstalled = true;
  }
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["style", "script", "iframe", "form", "input", "textarea", "select", "button", "object", "embed", "link", "meta"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
  });
}

export function CustomBlock({ html, className }: { html: string | null; className?: string }) {
  const clean = useMemo(() => (html ? sanitizeCustomHtml(html) : ""), [html]);
  if (!clean) return null;
  return (
    <div
      className={cn("custom-block w-full [overflow-wrap:anywhere]", className)}
      // HTML nettoyé ci-dessus (DOMPurify).
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
