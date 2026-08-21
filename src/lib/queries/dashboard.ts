import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo, StatusAgendamento } from "@/lib/types";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type DashboardKpis = {
  receitaMes: number;
  aReceber: number;
  inadimplencia: number;
  nfsEmitidas: number;
};

export type OperacionalKpis = {
  totalPacientesAtivos: number;
  totalFisiosAtivos: number;
  agendasProximas: number;
  divergenciaProntuario: number;
  sessoesRealizadasMes: number;
};

export type ProximaAgenda = {
  id: string;
  inicio: string;
  pacienteNome: string;
  fisioNome: string;
  status: StatusAgendamento;
};

export type DivergenciaProntuario = {
  pacienteId: string;
  pacienteNome: string;
  data: string;
};

export type ReceitaMensalItem = {
  mes: string;
  particular: number;
  judicial: number;
  convenio: number;
  puc: number;
  total: number;
};

export type DashboardHomeData = {
  kpis: OperacionalKpis;
  divergencias: DivergenciaProntuario[];
  proximasAgendas: ProximaAgenda[];
  atividadeSemanal: { dia: string; sessoes: number }[];
  pacientesPorTipo: { tipo: PacienteTipo; count: number }[];
  divergenciaTrend: { semana: string; agendas: number; divergencias: number }[];
};

const TIPOS: PacienteTipo[] = ["particular", "judicial", "convenio", "puc"];

function weekLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export async function fetchDashboardHome(
  ano: number,
  mes: number,
  fisioterapeutaId?: string | null,
): Promise<DashboardHomeData> {
  const mesInicio = new Date(ano, mes - 1, 1);
  const mesFim = new Date(ano, mes, 1);
  const now = new Date();
  const proximosSeteDias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const isCurrentMonth = ano === now.getFullYear() && mes === now.getMonth() + 1;
  const atividadeFim = isCurrentMonth
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    : mesFim;
  const atividadeInicio = new Date(atividadeFim.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (atividadeInicio < mesInicio) atividadeInicio.setTime(mesInicio.getTime());
  atividadeInicio.setHours(0, 0, 0, 0);

  let pacientesQuery = supabase.from("pacientes").select("id, tipo").eq("ativo", true);
  if (fisioterapeutaId) pacientesQuery = pacientesQuery.eq("fisioterapeuta_id", fisioterapeutaId);

  const pacientesCountQuery = fisioterapeutaId
    ? Promise.resolve({ count: 0, error: null })
    : supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("ativo", true);

  let realizadosQuery = supabase
    .from("agendamentos")
    .select("paciente_id, inicio, pacientes(nome)")
    .eq("status", "realizado")
    .gte("inicio", mesInicio.toISOString())
    .lt("inicio", mesFim.toISOString())
    .order("inicio", { ascending: false });
  if (fisioterapeutaId) realizadosQuery = realizadosQuery.eq("fisioterapeuta_id", fisioterapeutaId);

  let semanaQuery = supabase
    .from("agendamentos")
    .select("inicio")
    .eq("status", "realizado")
    .gte("inicio", atividadeInicio.toISOString())
    .lt("inicio", atividadeFim.toISOString());
  if (fisioterapeutaId) semanaQuery = semanaQuery.eq("fisioterapeuta_id", fisioterapeutaId);

  let proximasCountQuery = supabase
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .in("status", ["agendado", "confirmado"])
    .gte("inicio", now.toISOString())
    .lt("inicio", proximosSeteDias.toISOString());
  if (fisioterapeutaId)
    proximasCountQuery = proximasCountQuery.eq("fisioterapeuta_id", fisioterapeutaId);

  let proximasListQuery = supabase
    .from("agendamentos")
    .select("id, inicio, status, pacientes(nome), fisioterapeutas!fisioterapeuta_id(nome)")
    .in("status", ["agendado", "confirmado"])
    .gte("inicio", now.toISOString())
    .lt("inicio", proximosSeteDias.toISOString())
    .order("inicio", { ascending: true })
    .limit(15);
  if (fisioterapeutaId)
    proximasListQuery = proximasListQuery.eq("fisioterapeuta_id", fisioterapeutaId);

  const [
    pacientesResult,
    pacientesCountResult,
    fisiosResult,
    agendasProximasResult,
    realizadosResult,
    evolucoesResult,
    proximasListResult,
    semanaResult,
  ] = await Promise.all([
    pacientesQuery,
    pacientesCountQuery,
    fisioterapeutaId
      ? Promise.resolve({ data: null, error: null, count: 0 })
      : supabase
          .from("fisioterapeutas")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true),
    proximasCountQuery,
    realizadosQuery,
    supabase
      .from("prontuario_evolucoes")
      .select("paciente_id, data")
      .gte("data", toIsoDate(mesInicio))
      .lt("data", toIsoDate(mesFim)),
    proximasListQuery,
    semanaQuery,
  ]);

  if (pacientesResult.error) throw pacientesResult.error;
  if (pacientesCountResult.error) throw pacientesCountResult.error;
  if (fisiosResult.error) throw fisiosResult.error;
  if (agendasProximasResult.error) throw agendasProximasResult.error;
  if (realizadosResult.error) throw realizadosResult.error;
  if (evolucoesResult.error) throw evolucoesResult.error;
  if (proximasListResult.error) throw proximasListResult.error;

  const evolucoesChaves = new Set(
    (evolucoesResult.data ?? []).map((e) => `${e.paciente_id}_${e.data}`),
  );

  const divergenciasAll: DivergenciaProntuario[] = [];
  for (const a of realizadosResult.data ?? []) {
    if (!a.paciente_id) continue;
    const data = a.inicio.slice(0, 10);
    if (evolucoesChaves.has(`${a.paciente_id}_${data}`)) continue;
    const pac = a.pacientes as { nome: string } | null;
    divergenciasAll.push({
      pacienteId: a.paciente_id,
      pacienteNome: pac?.nome ?? "—",
      data,
    });
  }
  const divergencias = divergenciasAll.slice(0, 20);
  const sessoesRealizadasMes = (realizadosResult.data ?? []).length;

  const proximasAgendas: ProximaAgenda[] = (proximasListResult.data ?? []).map((row) => {
    const pac = row.pacientes as { nome: string } | null;
    const fisio = row.fisioterapeutas as { nome: string } | null;
    return {
      id: row.id,
      inicio: row.inicio,
      status: row.status,
      pacienteNome: pac?.nome ?? "—",
      fisioNome: fisio?.nome ?? "—",
    };
  });

  if (semanaResult.error) throw semanaResult.error;

  const pacientesRows = pacientesResult.data ?? [];
  const pacientesPorTipo = TIPOS.map((tipo) => ({
    tipo,
    count: pacientesRows.filter((p) => p.tipo === tipo).length,
  }));

  const atividadeBuckets = new Map<string, number>();
  const atividadeDays = Math.max(
    1,
    Math.round((atividadeFim.getTime() - atividadeInicio.getTime()) / (24 * 60 * 60 * 1000)),
  );
  for (let i = 0; i < atividadeDays; i++) {
    const d = new Date(atividadeInicio.getTime() + i * 24 * 60 * 60 * 1000);
    atividadeBuckets.set(toIsoDate(d), 0);
  }
  for (const row of semanaResult.data ?? []) {
    const key = row.inicio.slice(0, 10);
    if (atividadeBuckets.has(key)) {
      atividadeBuckets.set(key, (atividadeBuckets.get(key) ?? 0) + 1);
    }
  }
  const atividadeSemanal = Array.from(atividadeBuckets.entries()).map(([iso, sessoes]) => ({
    dia: new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }),
    sessoes,
  }));

  const divergenciaTrend: { semana: string; agendas: number; divergencias: number }[] = [];
  for (let w = 0; w < 4; w++) {
    const start = new Date(ano, mes - 1, 1 + w * 7);
    if (start >= mesFim) break;
    const end = new Date(Math.min(start.getTime() + 7 * 24 * 60 * 60 * 1000, mesFim.getTime()));
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    let agendasSemana = 0;
    let divergSemana = 0;
    for (const a of realizadosResult.data ?? []) {
      if (a.inicio >= startIso && a.inicio < endIso) {
        agendasSemana++;
        const data = a.inicio.slice(0, 10);
        if (!a.paciente_id || evolucoesChaves.has(`${a.paciente_id}_${data}`)) continue;
        divergSemana++;
      }
    }
    divergenciaTrend.push({
      semana: weekLabel(start),
      agendas: agendasSemana,
      divergencias: divergSemana,
    });
  }

  return {
    kpis: {
      totalPacientesAtivos: fisioterapeutaId
        ? pacientesRows.length
        : (pacientesCountResult.count ?? pacientesRows.length),
      totalFisiosAtivos: fisioterapeutaId ? 0 : (fisiosResult.count ?? 0),
      agendasProximas: agendasProximasResult.count ?? 0,
      divergenciaProntuario: divergenciasAll.length,
      sessoesRealizadasMes,
    },
    divergencias,
    proximasAgendas,
    atividadeSemanal,
    pacientesPorTipo,
    divergenciaTrend,
  };
}

/** @deprecated Use fetchDashboardHome */
export async function fetchOperacionalKpis(): Promise<OperacionalKpis> {
  const now = new Date();
  const data = await fetchDashboardHome(now.getFullYear(), now.getMonth() + 1);
  return data.kpis;
}

/** @deprecated Use fetchDashboardHome */
export async function fetchProximasAgendas(
  limit = 15,
  fisioterapeutaId?: string | null,
): Promise<ProximaAgenda[]> {
  const now = new Date();
  const data = await fetchDashboardHome(now.getFullYear(), now.getMonth() + 1, fisioterapeutaId);
  return data.proximasAgendas.slice(0, limit);
}

/** Sessões realizadas no mês sem evolução no prontuário no mesmo dia. */
export async function fetchDivergenciasProntuarioMes(
  ano: number,
  mes: number,
  fisioterapeutaId?: string | null,
): Promise<DivergenciaProntuario[]> {
  const mesInicio = new Date(ano, mes - 1, 1);
  const mesFim = new Date(ano, mes, 1);

  let realizadosQuery = supabase
    .from("agendamentos")
    .select("paciente_id, inicio, pacientes(nome)")
    .eq("status", "realizado")
    .gte("inicio", mesInicio.toISOString())
    .lt("inicio", mesFim.toISOString())
    .order("inicio", { ascending: false });
  if (fisioterapeutaId) realizadosQuery = realizadosQuery.eq("fisioterapeuta_id", fisioterapeutaId);

  const [realizadosResult, evolucoesResult] = await Promise.all([
    realizadosQuery,
    supabase
      .from("prontuario_evolucoes")
      .select("paciente_id, data")
      .gte("data", toIsoDate(mesInicio))
      .lt("data", toIsoDate(mesFim)),
  ]);

  if (realizadosResult.error) throw realizadosResult.error;
  if (evolucoesResult.error) throw evolucoesResult.error;

  const evolucoesChaves = new Set(
    (evolucoesResult.data ?? []).map((e) => `${e.paciente_id}_${e.data}`),
  );

  const divergencias: DivergenciaProntuario[] = [];
  for (const a of realizadosResult.data ?? []) {
    if (!a.paciente_id) continue;
    const data = a.inicio.slice(0, 10);
    if (evolucoesChaves.has(`${a.paciente_id}_${data}`)) continue;
    const pac = a.pacientes as { nome: string } | null;
    divergencias.push({
      pacienteId: a.paciente_id,
      pacienteNome: pac?.nome ?? "—",
      data,
    });
  }

  return divergencias;
}

/** @deprecated Use fetchDivergenciasProntuarioMes */
export async function fetchDivergenciasProntuario(limit = 20): Promise<DivergenciaProntuario[]> {
  const now = new Date();
  const data = await fetchDivergenciasProntuarioMes(now.getFullYear(), now.getMonth() + 1);
  return data.slice(0, limit);
}

export async function fetchReceitaMensal(
  anoInicio: number,
  anoFim: number,
): Promise<ReceitaMensalItem[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("valor, tipo, competencia_mes, competencia_ano, status")
    .gte("competencia_ano", anoInicio)
    .lte("competencia_ano", anoFim)
    .in("status", ["pago", "pendente", "aguardando_convenio", "aguardando_alvara"]);

  if (error) throw error;

  const buckets: Map<string, ReceitaMensalItem> = new Map();
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      particular: 0,
      judicial: 0,
      convenio: 0,
      puc: 0,
      total: 0,
    });
  }

  for (const c of data ?? []) {
    if (!c.competencia_mes || !c.competencia_ano) continue;
    const key = `${c.competencia_ano}-${String(c.competencia_mes).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const val = Number(c.valor) || 0;
    const tipo = c.tipo as keyof Pick<
      ReceitaMensalItem,
      "particular" | "judicial" | "convenio" | "puc"
    >;
    if (tipo in bucket) bucket[tipo] += val;
    bucket.total += val;
  }

  return Array.from(buckets.values());
}
