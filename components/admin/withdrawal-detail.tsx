"use client";

import { useCallback, useEffect, useState } from "react";

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
const DEADLINE_LABEL: Record<string, string> = {
  within: "Dans les délais",
  late: "Hors délai",
  exempt: "Exonéré",
  unknown: "—",
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
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

async function idToken(): Promise<string> {
  if (!window.shopify?.idToken) throw new Error("App Bridge indisponible");
  return window.shopify.idToken();
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

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const w = data.withdrawal;
  const orderUrl = w.shopify_order_id
    ? `https://${data.shop_domain}/admin/orders/${w.shopify_order_id}`
    : null;

  return (
    <div className="space-y-5 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-mono text-lg font-semibold">{w.reference}</h2>
          <p className="text-sm text-muted-foreground">
            {fmt(w.created_at)} · {STATUS_LABEL[w.status] ?? w.status}
          </p>
        </div>
        <button
          className="rounded-md border border-input px-3 py-1 text-sm hover:bg-accent"
          onClick={onClose}
        >
          Fermer
        </button>
      </div>

      {/* Infos */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Info label="Client" value={w.customer_name || "—"} />
        <Info label="Email" value={w.customer_email} />
        <Info
          label="Commande"
          value={`#${w.order_number}${w.order_verified ? " ✅ vérifiée" : " (non vérifiée)"}`}
        />
        <Info label="Pays" value={w.customer_country || "—"} />
        <Info label="Délai" value={DEADLINE_LABEL[w.deadline_status] ?? w.deadline_status} />
        <Info label="Échéance" value={w.deadline_at ? fmt(w.deadline_at) : "—"} />
        <Info label="Expédiée le" value={w.shipped_at ? fmt(w.shipped_at) : "—"} />
        <Info label="Remb. avant" value={w.refund_deadline_at ? fmt(w.refund_deadline_at) : "—"} />
      </div>

      {/* Articles */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Articles</h3>
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {w.items.map((it, i) => (
            <li key={i}>
              {it.title} × {it.quantity}
            </li>
          ))}
        </ul>
        {w.reason ? (
          <p className="mt-1 text-sm">
            <span className="font-semibold">Motif :</span> {w.reason}
          </p>
        ) : null}
      </div>

      {/* Statut */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Statut</h3>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              disabled={busy || s === w.status}
              onClick={() => mutate({ action: "status", status: s })}
              className={`rounded-md border px-3 py-1 text-sm disabled:opacity-50 ${
                s === w.status
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent"
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
            className="mt-2 inline-block text-sm text-primary underline"
          >
            Voir la commande dans Shopify (rembourser) →
          </a>
        ) : null}
      </div>

      {/* Timeline */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Historique</h3>
        <ul className="space-y-1 text-sm">
          {data.events.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">{fmt(e.created_at)}</span>
              <span>
                {EVENT_LABEL[e.type] ?? e.type}
                {e.note ? ` (${e.note})` : ""}
                <span className="text-muted-foreground"> · {e.actor}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Notes */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Notes internes</h3>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ajouter une note…"
            className="flex-1 rounded-md border border-input px-2 py-1 text-sm"
          />
          <button
            disabled={busy || !note.trim()}
            onClick={() => {
              void mutate({ action: "note", body: note }).then(() => setNote(""));
            }}
            className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {data.notes.map((n) => (
            <li key={n.id} className="rounded-md bg-muted/50 px-2 py-1">
              <span className="text-muted-foreground">{fmt(n.created_at)} · </span>
              {n.body}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
