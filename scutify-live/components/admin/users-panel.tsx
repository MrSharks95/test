"use client";

import { RefreshCw, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { formatMuteUntil, isMutedNow } from "@/lib/chat/format";

export type ModeratedUser = {
  id: string;
  pseudo: string;
  email: string | null;
  muted_until: string | null;
  banned: boolean;
};

type Props = {
  users: ModeratedUser[] | null;
  loading: boolean;
  onRefresh: () => void;
  onUnmute: (user: ModeratedUser) => void;
  onUnban: (user: ModeratedUser) => void;
};

export function UsersPanel({ users, loading, onRefresh, onUnmute, onUnban }: Props) {
  const now = useNow(true, 15_000);
  const active = (users ?? []).filter((u) => u.banned || isMutedNow(u.muted_until, now));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Utilisateurs mutés / bannis</CardTitle>
          <CardDescription>Annule une sanction à tout moment.</CardDescription>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Actualiser">
          <RefreshCw />
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !users ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : active.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun utilisateur sanctionné.</p>
        ) : (
          <ul className="divide-y">
            {active.map((user) => (
              <li key={user.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-brand-navy">
                    <span className="truncate">{user.pseudo}</span>
                    {user.banned ? (
                      <Badge variant="destructive">Banni</Badge>
                    ) : (
                      <Badge variant="accent">Muté · {formatMuteUntil(user.muted_until as string, now)}</Badge>
                    )}
                  </p>
                  {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => (user.banned ? onUnban(user) : onUnmute(user))}
                >
                  <Undo2 /> {user.banned ? "Débannir" : "Démuter"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
