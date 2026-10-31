import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-navy px-6 text-center text-white">
      <p className="text-5xl font-extrabold text-brand-sky">404</p>
      <p className="text-lg font-semibold">Cette page n&apos;existe pas.</p>
      <Button asChild variant="accent">
        <Link href="/live">Rejoindre le live</Link>
      </Button>
    </main>
  );
}
