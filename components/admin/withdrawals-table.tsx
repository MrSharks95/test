"use client";

import { useCallback, useEffect, useState } from "react";

import { DeadlineBadge, StatusBadge, VerifiedBadge } from "@/components/admin/badges";
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

interface Stats {
  total: number;
  new: number;
  in_progress: number;
  done: number;
  refused: number;
}

// App Bridge (CDN) exposes a global `shopify` with idToken() inside the admin.
declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}

export function WithdrawalsTable() {
  const [rows, setRows] = useState<Withdrawal[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
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
      const json = (await res.json()) as { withdrawals: Withdrawal[]; stats: Stats };
      setRows(json.withdrawals);
      setStats(json.stats);
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

  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
      </div>
    );
  if (rows === null)
    return <p className="text-sm text-slate-500">Chargement…</p>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total" value={stats.total} accent="text-slate-900" />
          <StatCard label="Nouvelles" value={stats.new} accent="text-blue-600" />
          <StatCard label="En cours" value={stats.in_progress} accent="text-amber-600" />
          <StatCard label="Traitées" value={stats.done} accent="text-emerald-600" />
          <StatCard label="Refusées" value={stats.refused} accent="text-rose-600" />
        </div>
      ) : null}

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Demandes ({rows.length})
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Aucune demande pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Référence</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Commande</th>
                  <th className="px-4 py-2 font-medium">Délai</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr
                    key={w.reference}
                    onClick={() => setSelected(w.reference)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                      {w.reference}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(w.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {w.customer_name || "—"}
                      </div>
                      <div className="text-slate-500">{w.customer_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">#{w.order_number}</div>
                      <VerifiedBadge verified={w.order_verified} />
                    </td>
                    <td className="px-4 py-3">
                      <DeadlineBadge status={w.deadline_status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
