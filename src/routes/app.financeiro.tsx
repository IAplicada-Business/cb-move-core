import { createFileRoute } from "@tanstack/react-router";

import { DashboardFinanceiro } from "@/components/domain/DashboardFinanceiro";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Dashboard Financeiro · CB MOVE" }] }),
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
