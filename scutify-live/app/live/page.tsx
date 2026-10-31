import type { Metadata } from "next";

import { LiveShell } from "@/components/live/live-shell";

export const metadata: Metadata = {
  title: "En direct",
  description: "Suis la conférence Scutify en direct et échange dans le chat.",
};

export default function LivePage() {
  return <LiveShell />;
}
