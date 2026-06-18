import type { Metadata } from "next";
import Script from "next/script";

import { env } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  title: "EU Withdrawal",
  description:
    "Right-of-withdrawal button for Shopify stores — EU Directive 2023/2673 compliance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        {/* Shopify App Bridge — required for the embedded admin (session token). */}
        <Script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={env.SHOPIFY_API_KEY}
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
