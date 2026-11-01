import type { Metadata } from "next";

import { LiveShell } from "@/components/live/live-shell";

export const metadata: Metadata = {
  title: { absolute: "Karine et Richard · Le live" },
  description: "Le live exclusif de Karine et Richard, lundi 2 novembre à 20h00.",
};

export default function LivePage() {
  return <LiveShell />;
}
