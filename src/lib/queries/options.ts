import type { DashboardHomeData, DivergenciaProntuario } from "./dashboard";
import {
  fetchDashboardHome,
  fetchDivergenciasProntuarioMes,
  fetchReceitaMensal,
} from "./dashboard";
import { fetchFinanceiroKpisHistorico, fetchFinanceiroKpisPorTipo } from "./financeiro";
import { queryKeys } from "./keys";

export function dashboardHomeOptions(ano: number, mes: number, fisioterapeutaId?: string | null) {
  return {
    queryKey: queryKeys.dashboard.home(ano, mes, fisioterapeutaId),
    queryFn: () => fetchDashboardHome(ano, mes, fisioterapeutaId),
    staleTime: 30_000,
  };
}

export function receitaMensalOptions(ano: number) {
  return {
    queryKey: queryKeys.dashboard.receitaMensal(ano, ano),
    queryFn: () => fetchReceitaMensal(ano, ano),
    staleTime: 60_000,
  };
}

export function financeiroKpisPorTipoOptions(mes: number, ano: number) {
  return {
    queryKey: queryKeys.financeiro.kpisPorTipo(ano, mes),
    queryFn: () => fetchFinanceiroKpisPorTipo(mes, ano),
    staleTime: 30_000,
  };
}

export function financeiroKpisHistoricoOptions() {
  return {
    queryKey: queryKeys.financeiro.kpisHistorico(),
    queryFn: () => fetchFinanceiroKpisHistorico(),
    staleTime: 60_000,
  };
}

export function divergenciasAgendaOptions(
  ano: number,
  mes: number,
  fisioterapeutaId?: string | null,
) {
  return {
    queryKey: [...queryKeys.dashboard.divergencias(ano, mes), fisioterapeutaId ?? null] as const,
    queryFn: () => fetchDivergenciasProntuarioMes(ano, mes, fisioterapeutaId),
    staleTime: 30_000,
  };
}

export type { DashboardHomeData, DivergenciaProntuario };
