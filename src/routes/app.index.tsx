import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Stethoscope, CalendarClock, AlertOctagon, TrendingUp } from "lucide-react";

import { KpiCard } from "@/components/domain/KpiCard";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { AgendaPreviewList, DivergenciaPreviewList } from "@/components/domain/DashboardLists";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { PageHeader } from "@/components/brand/PageHeader";
import { dashboardHomeOptions } from "@/lib/queries/options";
import { useAuth } from "@/lib/auth";
import { can, isFisioScopedUser } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard · CB MOVE" }] }),
  loader: ({ context }) => {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    return context.queryClient.ensureQueryData(dashboardHomeOptions(ano, mes));
  },
  pendingComponent: () => <LoadingState />,
  pendingMs: 200,
  component: Dashboard,
});

function Dashboard() {
  const { roles, fisioterapeutaId } = useAuth();
  const isFisioScoped = isFisioScopedUser(roles, fisioterapeutaId);
  const podeVerFinanceiro = can.viewFinance(roles, fisioterapeutaId);
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const { data, isLoading } = useQuery(dashboardHomeOptions(ano, mes));

  const kpis = data?.kpis;
  const proximas = data?.proximasAgendas ?? [];
  const divergencias = data?.divergencias ?? [];
  const divergenciaCount = kpis?.divergenciaProntuario ?? 0;

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Operação" }, { label: "Dashboard" }]}
        title="Dashboard"
        description={
          isFisioScoped
            ? "Sua visão clínica — pacientes, agenda e conformidade do prontuário"
            : "Visão operacional — pacientes, equipe, agendas e conformidade do prontuário"
        }
        actions={
          podeVerFinanceiro ? (
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link to="/app/financeiro">
                <TrendingUp className="h-4 w-4" />
                Dashboard Financeiro
              </Link>
            </Button>
          ) : undefined
        }
      />

      <KpiGrid columns={isFisioScoped ? 3 : 4}>
        <KpiCard
          label={isFisioScoped ? "Meus pacientes" : "Pacientes ativos"}
          value={kpis?.totalPacientesAtivos ?? 0}
          accent="cyan"
          icon={<Users className="h-5 w-5" />}
        />
        {!isFisioScoped && (
          <KpiCard
            label="Fisioterapeutas ativos"
            value={kpis?.totalFisiosAtivos ?? 0}
            accent="purple"
            icon={<Stethoscope className="h-5 w-5" />}
          />
        )}
        <KpiCard
          label="Agendas (7 dias)"
          value={kpis?.agendasProximas ?? 0}
          accent="orange"
          icon={<CalendarClock className="h-5 w-5" />}
          hint="Agendado ou confirmado"
        />
        <KpiCard
          label="Divergências"
          value={divergenciaCount}
          accent="magenta"
          icon={<AlertOctagon className="h-5 w-5" />}
          hint="Sessões sem evolução no mês"
          share={
            (kpis?.agendasProximas ?? 0) > 0
              ? Math.min(100, (divergenciaCount / (kpis?.agendasProximas ?? 1)) * 100)
              : undefined
          }
        />
      </KpiGrid>

      {divergenciaCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 text-sm text-[#92400E]">
          <AlertOctagon className="h-5 w-5 shrink-0" />
          <p className="flex-1 min-w-[200px]">
            <strong>{divergenciaCount}</strong> sessão(ões) realizada(s) neste mês ainda não têm
            evolução no prontuário.
          </p>
          <Button variant="outline" size="sm" className="border-[#FDE68A] bg-white" asChild>
            <Link to="/app/prontuario" search={{ tab: "visao-geral" }}>
              Ver prontuários
            </Link>
          </Button>
        </div>
      )}

      <DashboardSection
        eyebrow="Agenda"
        accent="lime"
        title="Próximas agendas"
        badge={<DashboardSectionBadge accent="lime">7 dias</DashboardSectionBadge>}
        description="Agendamentos confirmados ou pendentes nos próximos 7 dias"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/agenda">{isFisioScoped ? "Minha agenda" : "Agenda completa"}</Link>
          </Button>
        }
        noPadding
        bodyClassName="px-6 pb-2"
      >
        {isLoading ? (
          <LoadingState />
        ) : proximas.length === 0 ? (
          <div className="py-6">
            <EmptyState
              title="Nenhuma agenda nos próximos 7 dias"
              description="Novos agendamentos aparecerão aqui."
            />
          </div>
        ) : (
          <AgendaPreviewList items={proximas} showFisio={!isFisioScoped} />
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Prontuário"
        accent="orange"
        title="Divergências prontuário × agenda"
        badge={
          divergencias.length > 0 ? (
            <DashboardSectionBadge accent="orange">{divergencias.length}</DashboardSectionBadge>
          ) : undefined
        }
        description="Sessões realizadas no mês sem evolução registrada no mesmo dia"
        noPadding
        bodyClassName="p-6"
      >
        {isLoading ? (
          <LoadingState />
        ) : divergencias.length === 0 ? (
          <EmptyState
            title="Nenhuma divergência no mês"
            description="Todas as sessões realizadas têm evolução correspondente."
          />
        ) : (
          <DivergenciaPreviewList items={divergencias} />
        )}
      </DashboardSection>
    </DashboardPage>
  );
}
