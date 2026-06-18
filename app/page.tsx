import { WithdrawalsTable } from "@/components/admin/withdrawals-table";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="container mx-auto space-y-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Demandes de rétractation</h1>
        <p className="text-sm text-muted-foreground">
          Les demandes reçues via votre formulaire de rétractation (directive UE
          2023/2673).
        </p>
      </div>
      <WithdrawalsTable />
    </main>
  );
}
