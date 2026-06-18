"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { DeadlineBadge, StatusBadge, VerifiedBadge } from "@/components/admin/badges";

interface Item {
  title: string;
  quantity: number;
  lineItemId?: string | null;
}
interface Withdrawal {
  id: string;
  reference: string;
  customer_name: string | null;
  customer_email: string;
  order_number: string;
  order_verified: boolean;
  customer_country: string | null;
  items: Item[];
  reason: string | null;
  status: string;
  shipped_at: string | null;
  deadline_status: string;
  deadline_at: string | null;
  refund_deadline_at: string | null;
  created_at: string;
  shopify_order_id: number | null;
}
interface Event {
  type: string;
  actor: string;
  note: string | null;
  created_at: string;
}
interface Note {
  id: string;
  body: string;
  created_at: string;
}
interface Detail {
  withdrawal: Withdrawal;
  shop_domain: string;
  events: Event[];
  notes: Note[];
}

const STATUSES = ["new", "in_progress", "done", "refused"] as const;
const STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  in_progress: "En cours",
  done: "Traitée",
  refused: "Refusée",
};
const EVENT_LABEL: Record<string, string> = {
  created: "Demande créée",
  order_verified: "Commande vérifiée",
  email_sent: "Email envoyé",
  email_error: "Échec d'envoi email",
  status_changed: "Statut modifié",
  refunded: "Remboursé",
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

async function idToken(): Promise<string> {
  if (!window.shopify?.idToken) throw new Error("App Bridge indisponible");
  return window.shopify.idToken();
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {title ? (
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-slate-900">{children}</div>
    </div>
  );
}

export function WithdrawalDetail({
  reference,
  onClose,
  onChanged,
}: {
  reference: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await idToken();
      const res = await fetch(`/api/admin/withdrawals/${reference}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setData((await res.json()) as Detail);
    } catch {
      setError("Impossible de charger la demande.");
    }
  }, [reference]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const token = await idToken();
      const res = await fetch(`/api/admin/withdrawals/${reference}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      await load();
      onChanged();
    } catch {
      setError("L'action a échoué.");
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
      </div>
    );
  if (!data) return <p className="text-sm text-slate-500">Chargement…</p>;

  const w = data.withdrawal;
  const orderUrl = w.shopify_order_id
    ? `https://${data.shop_domain}/admin/orders/${w.shopify_order_id}`
    : null;

  return (
    <div className="space-y-4">
      <button
        className="text-sm font-medium text-slate-500 hover:text-slate-900"
        onClick={onClose}
      >
        ← Retour aux demandes
      </button>

      {/* Résumé */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-mono text-xl font-semibold text-slate-900">
              {w.reference}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Reçue le {fmt(w.created_at)}
            </p>
          </div>
          <StatusBadge status={w.status} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <Info label="Client">{w.customer_name || "—"}</Info>
          <Info label="Email">
            <span className="break-all">{w.customer_email}</span>
          </Info>
          <Info label="Commande">
            <span className="mr-2">#{w.order_number}</span>
            <VerifiedBadge verified={w.order_verified} />
          </Info>
          <Info label="Pays">{w.customer_country || "—"}</Info>
          <Info label="Délai">
            <DeadlineBadge status={w.deadline_status} />
          </Info>
          <Info label="Échéance">{w.deadline_at ? fmt(w.deadline_at) : "—"}</Info>
          <Info label="Expédiée le">{w.shipped_at ? fmt(w.shipped_at) : "—"}</Info>
          <Info label="Remb. avant">
            {w.refund_deadline_at ? fmt(w.refund_deadline_at) : "—"}
          </Info>
        </div>
      </Card>

      {/* Articles */}
      <Card title="Articles concernés">
        <ul className="divide-y divide-slate-100">
          {w.items.map((it, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-900">{it.title}</span>
              <span className="text-slate-500">× {it.quantity}</span>
            </li>
          ))}
        </ul>
        {w.reason ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Motif :</span> {w.reason}
          </p>
        ) : null}
      </Card>

      {/* Statut & remboursement */}
      <Card title="Traitement">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              disabled={busy || s === w.status}
              onClick={() => mutate({ action: "status", status: s })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-default ${
                s === w.status
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {orderUrl ? (
          <a
            href={orderUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Voir la commande dans Shopify (rembourser) →
          </a>
        ) : null}
      </Card>

      {/* Historique */}
      <Card title="Historique">
        <ol className="space-y-3">
          {data.events.map((e, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <div className="mt-1 flex flex-col items-center">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                {i < data.events.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-slate-200" />
                ) : null}
              </div>
              <div>
                <div className="font-medium text-slate-900">
                  {EVENT_LABEL[e.type] ?? e.type}
                  {e.note ? (
                    <span className="font-normal text-slate-500"> ({e.note})</span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-400">
                  {fmt(e.created_at)} · {e.actor}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Notes */}
      <Card title="Notes internes">
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ajouter une note…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button
            disabled={busy || !note.trim()}
            onClick={() => {
              void mutate({ action: "note", body: note }).then(() => setNote(""));
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
        {data.notes.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {data.notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="text-xs text-slate-400">{fmt(n.created_at)}</div>
                <div className="text-slate-800">{n.body}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Aucune note.</p>
        )}
      </Card>
    </div>
  );
}
