import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";

import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Scutify Live", template: "%s · Scutify Live" },
  description: "Conférence Scutify en direct, avec chat modéré.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Permet d'utiliser env(safe-area-inset-*) (encoche, barre d'accueil iOS).
  viewportFit: "cover",
  // Android Chrome : le clavier réduit la page au lieu de la recouvrir.
  interactiveWidget: "resizes-content",
  themeColor: "#003366",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
