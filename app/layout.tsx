import type { Metadata } from "next";

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
        {/* Shopify App Bridge — must load early with the api key so the
            embedded admin can mint session tokens (window.shopify.idToken). */}
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={env.SHOPIFY_API_KEY}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
