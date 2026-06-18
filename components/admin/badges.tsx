import type { ReactNode } from "react";

function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
  refused: "bg-rose-100 text-rose-800",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  in_progress: "En cours",
  done: "Traitée",
  refused: "Refusée",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "bg-slate-100 text-slate-700"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const DEADLINE_TONE: Record<string, string> = {
  within: "bg-emerald-100 text-emerald-800",
  late: "bg-rose-100 text-rose-800",
  exempt: "bg-slate-100 text-slate-700",
  unknown: "bg-slate-100 text-slate-500",
};
const DEADLINE_LABEL: Record<string, string> = {
  within: "Dans les délais",
  late: "Hors délai",
  exempt: "Exonéré",
  unknown: "—",
};

export function DeadlineBadge({ status }: { status: string }) {
  return (
    <Badge tone={DEADLINE_TONE[status] ?? "bg-slate-100 text-slate-500"}>
      {DEADLINE_LABEL[status] ?? status}
    </Badge>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge tone="bg-emerald-100 text-emerald-800">✓ Vérifiée</Badge>
  ) : (
    <Badge tone="bg-slate-100 text-slate-500">Non vérifiée</Badge>
  );
}
