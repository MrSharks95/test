import { WithdrawalsTable } from "@/components/admin/withdrawals-table";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Demandes de rétractation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les demandes reçues via votre formulaire de rétractation
            (directive UE 2023/2673).
          </p>
        </header>
        <WithdrawalsTable />
      </div>
    </main>
  );
}
