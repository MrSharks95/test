"use client";

import { useCallback, useEffect, useState } from "react";

import { WithdrawalDetail } from "@/components/admin/withdrawal-detail";

interface Withdrawal {
  reference: string;
  customer_name: string | null;
  customer_email: string;
  order_number: string;
  order_verified: boolean;
  customer_country: string | null;
  deadline_status: string;
  deadline_at: string | null;
  status: string;
  created_at: string;
}

// App Bridge (CDN) exposes a global `shopify` with idToken() inside the admin.
declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

const DEADLINE_LABEL: Record<string, string> = {
  within: "Dans les délais",
  late: "Hors délai",
  exempt: "Exonéré",
  unknown: "—",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  in_progress: "En cours",
  done: "Traitée",
  refused: "Refusée",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function WithdrawalsTable() {
  const [rows, setRows] = useState<Withdrawal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (!window.shopify?.idToken) {
        setError("Ouvre cette page depuis l'admin Shopify (App Bridge requis).");
        return;
      }
      const token = await window.shopify.idToken();
      const res = await fetch("/api/admin/withdrawals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { withdrawals: Withdrawal[] };
      setRows(json.withdrawals);
    } catch {
      setError("Impossible de charger les demandes.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (selected) {
    return (
      <WithdrawalDetail
        reference={selected}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    );
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (rows === null) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            <th className="px-3 py-2 font-semibold">Référence</th>
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Client</th>
            <th className="px-3 py-2 font-semibold">Commande</th>
            <th className="px-3 py-2 font-semibold">Vérifiée</th>
            <th className="px-3 py-2 font-semibold">Délai</th>
            <th className="px-3 py-2 font-semibold">Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr
              key={w.reference}
              onClick={() => setSelected(w.reference)}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2 font-mono">{w.reference}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(w.created_at)}</td>
              <td className="px-3 py-2">
                <div>{w.customer_name || "—"}</div>
                <div className="text-muted-foreground">{w.customer_email}</div>
              </td>
              <td className="px-3 py-2">#{w.order_number}</td>
              <td className="px-3 py-2">{w.order_verified ? "✅" : "—"}</td>
              <td className="px-3 py-2">{DEADLINE_LABEL[w.deadline_status] ?? w.deadline_status}</td>
              <td className="px-3 py-2">{STATUS_LABEL[w.status] ?? w.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
