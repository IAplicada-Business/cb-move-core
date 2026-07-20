import { supabase } from "@/integrations/supabase/client";
import { fetchFinanceiroKpis } from "./financeiro";

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
};

export type ProximaAgenda = {
  id: string;
  inicio: string;
  pacienteNome: string;
  fisioNome: string;
  status: string;
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

export async function fetchKpis(): Promise<DashboardKpis> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const [financeiro, nfResult] = await Promise.all([
    fetchFinanceiroKpis(mes, ano),
    supabase
      .from("notas_fiscais")
      .select("*", { count: "exact", head: true })
      .eq("status", "emitida")
      .gte("emissao", `${ano}-${String(mes).padStart(2, "0")}-01`)
      .lt("emissao", `${String(mes === 12 ? ano + 1 : ano)}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-01`),
  ]);

  if (nfResult.error) throw nfResult.error;

  return {
    receitaMes: financeiro.pago,
    aReceber: financeiro.pendente,
    inadimplencia: financeiro.vencido,
    nfsEmitidas: nfResult.count ?? 0,
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchOperacionalKpis(): Promise<OperacionalKpis> {
  const now = new Date();
  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const proximosSeteDias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [pacientesResult, fisiosResult, agendasProximasResult, realizadosResult, evolucoesResult] =
    await Promise.all([
      supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("fisioterapeutas").select("id", { count: "exact", head: true }).eq("ativo", true),
      supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .in("status", ["agendado", "confirmado"])
        .gte("inicio", now.toISOString())
        .lt("inicio", proximosSeteDias.toISOString()),
      supabase
        .from("agendamentos")
        .select("paciente_id, inicio")
        .eq("status", "realizado")
        .gte("inicio", mesInicio.toISOString())
        .lt("inicio", mesFim.toISOString()),
      supabase
        .from("prontuario_evolucoes")
        .select("paciente_id, data")
        .gte("data", toIsoDate(mesInicio))
        .lt("data", toIsoDate(mesFim)),
    ]);

  if (pacientesResult.error) throw pacientesResult.error;
  if (fisiosResult.error) throw fisiosResult.error;
  if (agendasProximasResult.error) throw agendasProximasResult.error;
  if (realizadosResult.error) throw realizadosResult.error;
  if (evolucoesResult.error) throw evolucoesResult.error;

  const evolucoesChaves = new Set(
    (evolucoesResult.data ?? []).map((e) => `${e.paciente_id}_${e.data}`),
  );

  const divergenciaProntuario = (realizadosResult.data ?? []).filter((a) => {
    if (!a.paciente_id) return false;
    const data = a.inicio.slice(0, 10);
    return !evolucoesChaves.has(`${a.paciente_id}_${data}`);
  }).length;

  return {
    totalPacientesAtivos: pacientesResult.count ?? 0,
    totalFisiosAtivos: fisiosResult.count ?? 0,
    agendasProximas: agendasProximasResult.count ?? 0,
    divergenciaProntuario,
  };
}

export async function fetchProximasAgendas(limit = 15): Promise<ProximaAgenda[]> {
  const now = new Date();
  const proximosSeteDias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("agendamentos")
    .select("id, inicio, status, pacientes(nome), fisioterapeutas(nome)")
    .in("status", ["agendado", "confirmado"])
    .gte("inicio", now.toISOString())
    .lt("inicio", proximosSeteDias.toISOString())
    .order("inicio", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
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
}

export async function fetchDivergenciasProntuario(limit = 20): Promise<DivergenciaProntuario[]> {
  const now = new Date();
  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [realizadosResult, evolucoesResult] = await Promise.all([
    supabase
      .from("agendamentos")
      .select("paciente_id, inicio, pacientes(nome)")
      .eq("status", "realizado")
      .gte("inicio", mesInicio.toISOString())
      .lt("inicio", mesFim.toISOString())
      .order("inicio", { ascending: false }),
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
    if (divergencias.length >= limit) break;
  }

  return divergencias;
}

export async function fetchReceitaMensal(anoInicio: number, anoFim: number): Promise<ReceitaMensalItem[]> {
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
    const tipo = c.tipo as keyof Pick<ReceitaMensalItem, "particular" | "judicial" | "convenio" | "puc">;
    if (tipo in bucket) bucket[tipo] += val;
    bucket.total += val;
  }

  return Array.from(buckets.values());
}
