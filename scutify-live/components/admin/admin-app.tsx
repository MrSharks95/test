"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/lib/chat/types";
import { getSupabase } from "@/lib/supabase/client";

import { AdminDashboard } from "./admin-dashboard";
import { LoginForm } from "./login-form";

type Gate =
  | { status: "checking" }
  | { status: "signed-out" }
  | { status: "forbidden"; email: string | null }
  | { status: "admin"; profile: Profile };

/**
 * Garde d'accès de /admin. Ce n'est qu'un confort d'interface : la sécurité
 * réelle est en base (RLS + vérification du rôle dans chaque fonction admin).
 */
export function AdminApp() {
  const supabase = getSupabase();
  const [gate, setGate] = useState<Gate>({ status: "checking" });

  const evaluate = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // Une session anonyme (spectateur du live) ne donne pas accès à l'admin.
    if (!session || session.user.is_anonymous) {
      setGate({ status: "signed-out" });
      return;
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,pseudo,email,role,muted_until,banned")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.error("[admin] lecture du profil impossible", error);
      setGate({ status: "forbidden", email: session.user.email ?? null });
      return;
    }
    setGate((current) => {
      if (profile?.role !== "admin") return { status: "forbidden", email: session.user.email ?? null };
      // Même admin : on garde l'objet pour ne pas remonter le tableau de bord.
      if (current.status === "admin" && current.profile.id === profile.id) return current;
      return { status: "admin", profile };
    });
  }, [supabase]);

  useEffect(() => {
    void evaluate();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Hors du callback : supabase-js déconseille d'y attendre d'autres appels.
        setTimeout(() => void evaluate(), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, evaluate]);

  if (gate.status === "admin") return <AdminDashboard profile={gate.profile} />;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-brand-navy p-4">
      <p className="text-2xl font-extrabold tracking-tight text-white">
        Scutify <span className="text-brand-sky">Live</span>
      </p>
      {gate.status === "checking" && <Loader2 className="size-6 animate-spin text-brand-sky" aria-label="Chargement" />}
      {gate.status === "signed-out" && <LoginForm />}
      {gate.status === "forbidden" && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" /> Accès refusé
            </CardTitle>
            <CardDescription>
              Le compte {gate.email ? <strong>{gate.email}</strong> : "connecté"} n&apos;a pas accès à
              l&apos;administration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => void supabase.auth.signOut()}>
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
