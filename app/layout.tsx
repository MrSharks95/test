import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
