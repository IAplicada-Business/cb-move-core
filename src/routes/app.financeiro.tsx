import { createFileRoute } from "@tanstack/react-router";

import { DashboardFinanceiro } from "@/components/domain/DashboardFinanceiro";
import { LoadingState } from "@/components/domain/LoadingState";
import { PageHeader } from "@/components/brand/PageHeader";
import { DashboardPage } from "@/components/domain/DashboardSection";
import { assertFinanceAccess } from "@/lib/route-access";
import {
  financeiroKpisHistoricoOptions,
  financeiroKpisPorTipoOptions,
  receitaMensalOptions,
} from "@/lib/queries/options";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Dashboard Financeiro · CB MOVE" }] }),
  beforeLoad: () => assertFinanceAccess(),
  loader: ({ context }) => {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    return Promise.all([
      context.queryClient.ensureQueryData(financeiroKpisPorTipoOptions(mes, ano)),
      context.queryClient.ensureQueryData(receitaMensalOptions(ano)),
      context.queryClient.ensureQueryData(financeiroKpisHistoricoOptions()),
    ]);
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
        description="Visão analítica de receita, recebimentos e extrato por competência."
      />
      <DashboardFinanceiro />
    </DashboardPage>
  );
}
