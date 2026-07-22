import { createFileRoute } from "@tanstack/react-router";

import { DashboardFinanceiro } from "@/components/domain/DashboardFinanceiro";
import { LoadingState } from "@/components/domain/LoadingState";
import { financeiroKpisPorTipoOptions } from "@/lib/queries/options";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Dashboard Financeiro · CB MOVE" }] }),
  loader: ({ context }) => {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    return context.queryClient.ensureQueryData(financeiroKpisPorTipoOptions(mes, ano));
  },
  pendingComponent: () => <LoadingState />,
  pendingMs: 200,
  component: FinanceiroPage,
});

function FinanceiroPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Receita por tipo, receita por convênio e extrato financeiro do mês
        </p>
      </header>
      <DashboardFinanceiro />
    </div>
  );
}
