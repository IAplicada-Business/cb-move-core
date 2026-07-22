import type { DashboardHomeData } from "./dashboard";
import { fetchDashboardHome } from "./dashboard";
import { fetchFinanceiroKpisPorTipo } from "./financeiro";
import { queryKeys } from "./keys";

export function dashboardHomeOptions(ano: number, mes: number) {
  return {
    queryKey: queryKeys.dashboard.home(ano, mes),
    queryFn: () => fetchDashboardHome(ano, mes),
    staleTime: 30_000,
  };
}

export function financeiroKpisPorTipoOptions(mes: number, ano: number) {
  return {
    queryKey: queryKeys.financeiro.kpisPorTipo(ano, mes),
    queryFn: () => fetchFinanceiroKpisPorTipo(mes, ano),
    staleTime: 30_000,
  };
}

export type { DashboardHomeData };
