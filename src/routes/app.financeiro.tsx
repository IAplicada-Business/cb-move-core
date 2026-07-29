import { createFileRoute } from "@tanstack/react-router";

import { DashboardFinanceiro } from "@/components/domain/DashboardFinanceiro";
import { LoadingState } from "@/components/domain/LoadingState";
import { PageHeader } from "@/components/brand/PageHeader";
import { DashboardPage } from "@/components/domain/DashboardSection";
import { assertFinanceAccess } from "@/lib/route-access";
import { financeiroKpisPorTipoOptions } from "@/lib/queries/options";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Dashboard Financeiro · CB MOVE" }] }),
  beforeLoad: () => assertFinanceAccess(),
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
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Financeiro" }, { label: "Dashboard" }]}
        title="Dashboard Financeiro"
        description="Receita por tipo e convênio, extrato filtrado e exportações CSV, XLSX e PDF."
      />
      <DashboardFinanceiro />
    </DashboardPage>
  );
}
