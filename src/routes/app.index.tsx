import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Stethoscope, CalendarClock, TrendingUp, Activity } from "lucide-react";

import { KpiCard } from "@/components/domain/KpiCard";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { AgendaPreviewList } from "@/components/domain/DashboardLists";
import { DashboardInsightBanner } from "@/components/domain/DashboardInsightBanner";
import { MonthPicker, monthPickerLabel } from "@/components/domain/MonthPicker";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusDistributionBar } from "@/components/domain/MetricVisuals";
import { GaugeChart } from "@/components/domain/charts/GaugeChart";
import { PacientesPorTipoBarChart } from "@/components/domain/charts/PacientesPorTipoBarChart";
import { DivergenciaTrendLineChart } from "@/components/domain/charts/TrendLineCharts";
import { PageHeader } from "@/components/brand/PageHeader";
import { dashboardHomeOptions } from "@/lib/queries/options";
import { useAuth } from "@/lib/auth";
import { can, isFisioScopedUser } from "@/lib/permissions";
import { assertMenuAccess } from "@/lib/route-access";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard · CB MOVE" }] }),
  beforeLoad: () => assertMenuAccess("app.dashboard"),
  component: Dashboard,
});

function Dashboard() {
  const { roles, fisioterapeutaId } = useAuth();
  const isFisioScoped = isFisioScopedUser(roles, fisioterapeutaId);
  const podeVerFinanceiro = can.viewFinance(roles, fisioterapeutaId);
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const [mes, setMes] = useState(mesAtual);
  const [ano, setAno] = useState(anoAtual);
  const isMesAtual = mes === mesAtual && ano === anoAtual;
  const periodoLabel = monthPickerLabel(mes, ano);
  const fisioScope = isFisioScoped ? fisioterapeutaId : null;

  const { data } = useQuery(dashboardHomeOptions(ano, mes, fisioScope));
  const noData = !data;

  const kpis = data?.kpis;
  const proximas = data?.proximasAgendas ?? [];
  const divergenciaCount = kpis?.divergenciaProntuario ?? 0;
  const sessoesRealizadas = kpis?.sessoesRealizadasMes ?? 0;
  const conformidadePct =
    sessoesRealizadas > 0
      ? Math.round(((sessoesRealizadas - divergenciaCount) / sessoesRealizadas) * 100)
      : 100;
  const conformidadeTone =
    conformidadePct >= 85 ? "success" : conformidadePct >= 60 ? "warning" : "danger";

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
          <>
            <p className="text-sm text-cb-muted">
              Competência ·{" "}
              <span className="font-semibold capitalize text-cb-ink">{periodoLabel}</span>
            </p>
            {!isMesAtual && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setMes(mesAtual);
                  setAno(anoAtual);
                }}
              >
                Mês atual
              </Button>
            )}
            <MonthPicker
              mes={mes}
              ano={ano}
              onChange={(nextMes, nextAno) => {
                setMes(nextMes);
                setAno(nextAno);
              }}
            />
            {podeVerFinanceiro && (
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link to="/app/financeiro">
                  <TrendingUp className="h-4 w-4" />
                  Financeiro
                </Link>
              </Button>
            )}
          </>
        }
      />

      <KpiGrid columns={isFisioScoped ? 3 : 4}>
        <KpiCard
          label={isFisioScoped ? "Meus pacientes" : "Pacientes ativos"}
          value={kpis?.totalPacientesAtivos ?? 0}
          accent="cyan"
          icon={<Users className="h-5 w-5" />}
          hint="Carteira ativa"
        />
        {!isFisioScoped && (
          <KpiCard
            label="Fisioterapeutas ativos"
            value={kpis?.totalFisiosAtivos ?? 0}
            accent="purple"
            icon={<Stethoscope className="h-5 w-5" />}
            hint="Equipe clínica"
          />
        )}
        <KpiCard
          label="Agendas (7 dias)"
          value={kpis?.agendasProximas ?? 0}
          accent="orange"
          icon={<CalendarClock className="h-5 w-5" />}
          delta={
            (kpis?.agendasProximas ?? 0) > 0
              ? { text: "Confirmadas ou pendentes", tone: "neutral" }
              : undefined
          }
          hint={(kpis?.agendasProximas ?? 0) === 0 ? "Sem agendamentos próximos" : undefined}
        />
        <KpiCard
          label="Sessões realizadas"
          value={sessoesRealizadas}
          accent="lime"
          icon={<Activity className="h-5 w-5" />}
          delta={
            sessoesRealizadas > 0
              ? {
                  text: `${conformidadePct}% com evolução`,
                  tone: conformidadePct >= 85 ? "up" : conformidadePct >= 60 ? "neutral" : "down",
                }
              : { text: isMesAtual ? "Mês atual" : periodoLabel, tone: "neutral" }
          }
        />
      </KpiGrid>

      {/* Hero analytics + sidebar — referência Behance SaaS */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <DashboardSection
            eyebrow="Pacientes"
            accent="purple"
            title="Ativos por tipo"
            description="Composição da carteira clínica"
            noPadding
            bodyClassName="px-4 pb-4 pt-2 sm:px-6"
          >
            {noData ? (
              <LoadingState />
            ) : (
              <PacientesPorTipoBarChart data={data?.pacientesPorTipo ?? []} />
            )}
          </DashboardSection>

          <DashboardSection
            eyebrow="Prontuário"
            accent="orange"
            title="Divergências vs agendas"
            badge={<DashboardSectionBadge accent="orange">4 semanas</DashboardSectionBadge>}
            description="Sessões realizadas e pendências por semana"
            noPadding
            bodyClassName="px-4 pb-4 pt-2 sm:px-6"
          >
            {noData ? (
              <LoadingState />
            ) : (
              <DivergenciaTrendLineChart data={data?.divergenciaTrend ?? []} />
            )}
          </DashboardSection>
        </div>

        <aside className="flex flex-col gap-6">
          <DashboardInsightBanner
            conformidadePct={conformidadePct}
            divergenciaCount={divergenciaCount}
            sessoesRealizadas={sessoesRealizadas}
            periodoLabel={periodoLabel}
          />

          <DashboardSection
            eyebrow="Conformidade"
            accent="lime"
            title="Prontuário × agenda"
            badge={<DashboardSectionBadge accent="lime">{periodoLabel}</DashboardSectionBadge>}
            noPadding
            bodyClassName="p-5"
          >
            {noData ? (
              <LoadingState />
            ) : sessoesRealizadas === 0 ? (
              <EmptyState
                title="Sem sessões"
                description={`Nenhuma sessão realizada em ${periodoLabel}.`}
              />
            ) : (
              <GaugeChart
                value={conformidadePct}
                max={100}
                label="conformes"
                sublabel={`${sessoesRealizadas - divergenciaCount} de ${sessoesRealizadas}`}
                tone={conformidadeTone}
              />
            )}
          </DashboardSection>

          {!noData && sessoesRealizadas > 0 && (
            <StatusDistributionBar
              totalLabel="Conformidade prontuário"
              formatValue={(n) => String(n)}
              segments={[
                {
                  label: "Conformes",
                  value: Math.max(0, sessoesRealizadas - divergenciaCount),
                  colorClass: "bg-cb-lime",
                },
                {
                  label: "Divergências",
                  value: divergenciaCount,
                  colorClass: "bg-cb-magenta",
                },
              ]}
            />
          )}

          {noData ? (
            <LoadingState />
          ) : (
            <DashboardSection
              eyebrow="Agenda"
              accent="lime"
              title="Atividade recente"
              description="Próximos agendamentos confirmados ou pendentes"
              noPadding
              bodyClassName="px-4 pb-2 sm:px-6"
              actions={
                <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                  <Link to="/app/agenda" search={{ visao: "atualizacoes" }}>
                    Ver mais
                  </Link>
                </Button>
              }
            >
              {proximas.length === 0 ? (
                <div className="px-2 py-8">
                  <EmptyState
                    title="Nenhuma agenda próxima"
                    description="Novos agendamentos aparecerão aqui."
                  />
                </div>
              ) : (
                <AgendaPreviewList items={proximas.slice(0, 2)} showFisio={!isFisioScoped} />
              )}
            </DashboardSection>
          )}
        </aside>
      </div>
    </DashboardPage>
  );
}
