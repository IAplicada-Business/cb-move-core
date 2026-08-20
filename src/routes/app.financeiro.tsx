import { createFileRoute } from "@tanstack/react-router";

import { DashboardFinanceiro } from "@/components/domain/DashboardFinanceiro";
import { PageHeader } from "@/components/brand/PageHeader";
import { DashboardPage } from "@/components/domain/DashboardSection";
import { assertMenuAccess } from "@/lib/route-access";
import {
  financeiroKpisHistoricoOptions,
  financeiroKpisPorTipoOptions,
  receitaMensalOptions,
} from "@/lib/queries/options";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Análises · CB MOVE" }] }),
  beforeLoad: () => assertMenuAccess("fin.financeiro"),
  loader: ({ context }) => {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    void context.queryClient.prefetchQuery(financeiroKpisPorTipoOptions(mes, ano));
    void context.queryClient.prefetchQuery(receitaMensalOptions(ano));
    void context.queryClient.prefetchQuery(financeiroKpisHistoricoOptions());
  },
  component: FinanceiroPage,
});

function FinanceiroPage() {
  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Financeiro" }, { label: "Análises" }]}
        title="Análises"
        description="Visão analítica de receita, recebimentos e extrato por competência."
      />
      <DashboardFinanceiro />
    </DashboardPage>
  );
}
