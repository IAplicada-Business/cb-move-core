import { supabase } from "@/integrations/supabase/client";
import { resolverFrequenciaExtrato } from "@/lib/domain/atendimento-cadastro";
import {
  calcularMetricaComparecimento,
  type MetricaComparecimento,
} from "@/lib/domain/frequencia";
import { fetchPaciente } from "@/lib/queries/pacientes";
import type { FrequenciaSigla } from "@/lib/types";

type SessaoMesRow = {
  paciente_id: string;
  sigla: FrequenciaSigla;
};

type CobrancaMesRow = {
  paciente_id: string;
  qtd_sessoes: number | null;
  frequencia_atendimento: string | null;
};

type PacienteFreqRow = {
  id: string;
  frequencia_atendimento: string | null;
};

function monthRange(mes: number, ano: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim =
    mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  return { inicio, fim };
}

function groupByPaciente<T extends { paciente_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.paciente_id) ?? [];
    list.push(row);
    map.set(row.paciente_id, list);
  }
  return map;
}

export async function fetchComparecimentoMensalPorPacientes(
  pacienteIds: string[],
  mes: number,
  ano: number,
): Promise<Record<string, MetricaComparecimento>> {
  if (pacienteIds.length === 0) return {};

  const uniqueIds = [...new Set(pacienteIds)];
  const { inicio, fim } = monthRange(mes, ano);

  const [sessoesRes, cobrancasRes, pacientesRes] = await Promise.all([
    supabase
      .from("sessoes")
      .select("paciente_id, sigla")
      .in("paciente_id", uniqueIds)
      .gte("data", inicio)
      .lt("data", fim),
    supabase
      .from("cobrancas")
      .select("paciente_id, qtd_sessoes, frequencia_atendimento")
      .in("paciente_id", uniqueIds)
      .eq("competencia_mes", mes)
      .eq("competencia_ano", ano),
    supabase
      .from("pacientes")
      .select("id, frequencia_atendimento")
      .in("id", uniqueIds),
  ]);

  if (sessoesRes.error) throw sessoesRes.error;
  if (cobrancasRes.error) throw cobrancasRes.error;
  if (pacientesRes.error) throw pacientesRes.error;

  const sessoesPorPaciente = groupByPaciente(
    (sessoesRes.data ?? []) as SessaoMesRow[],
  );

  const cobrancaPorPaciente = new Map<string, CobrancaMesRow>();
  for (const row of (cobrancasRes.data ?? []) as CobrancaMesRow[]) {
    if (!cobrancaPorPaciente.has(row.paciente_id)) {
      cobrancaPorPaciente.set(row.paciente_id, row);
    }
  }

  const pacientePorId = new Map<string, PacienteFreqRow>();
  for (const row of (pacientesRes.data ?? []) as PacienteFreqRow[]) {
    pacientePorId.set(row.id, row);
  }

  const result: Record<string, MetricaComparecimento> = {};
  for (const pacienteId of uniqueIds) {
    const cobranca = cobrancaPorPaciente.get(pacienteId);
    const paciente = pacientePorId.get(pacienteId);
    const frequenciaAtendimento = resolverFrequenciaExtrato(
      cobranca?.frequencia_atendimento,
      paciente?.frequencia_atendimento,
      null,
    );

    result[pacienteId] = calcularMetricaComparecimento(
      sessoesPorPaciente.get(pacienteId) ?? [],
      {
        qtdSessoesCobranca: cobranca?.qtd_sessoes,
        frequenciaAtendimento,
      },
    );
  }

  return result;
}

export async function fetchComparecimentoMesPaciente(
  pacienteId: string,
  mes: number,
  ano: number,
): Promise<MetricaComparecimento> {
  const metricas = await fetchComparecimentoMensalPorPacientes([pacienteId], mes, ano);
  if (metricas[pacienteId]) return metricas[pacienteId];

  const paciente = await fetchPaciente(pacienteId);
  return calcularMetricaComparecimento([], {
    frequenciaAtendimento: paciente?.frequenciaAtendimento ?? null,
  });
}

export type HistoricoComparecimentoMes = {
  mes: number;
  ano: number;
  label: string;
  metrica: MetricaComparecimento;
};

type SessaoHistoricoRow = {
  data: string;
  sigla: FrequenciaSigla;
};

type CobrancaHistoricoRow = {
  competencia_mes: number | null;
  competencia_ano: number | null;
  qtd_sessoes: number | null;
  frequencia_atendimento: string | null;
};

function monthKey(mes: number, ano: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function listRecentMonths(total: number): Array<{ mes: number; ano: number; label: string }> {
  const now = new Date();
  const items: Array<{ mes: number; ano: number; label: string }> = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    items.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }
  return items;
}

export async function fetchHistoricoComparecimentoPaciente(
  pacienteId: string,
  meses = 12,
): Promise<HistoricoComparecimentoMes[]> {
  const paciente = await fetchPaciente(pacienteId);
  if (!paciente) return [];

  const periodos = listRecentMonths(meses);
  const oldest = periodos[periodos.length - 1];
  const newest = periodos[0];
  const { inicio } = monthRange(oldest.mes, oldest.ano);
  const { fim } = monthRange(newest.mes, newest.ano);

  const [sessoesRes, cobrancasRes] = await Promise.all([
    supabase
      .from("sessoes")
      .select("data, sigla")
      .eq("paciente_id", pacienteId)
      .gte("data", inicio)
      .lt("data", fim),
    supabase
      .from("cobrancas")
      .select("competencia_mes, competencia_ano, qtd_sessoes, frequencia_atendimento")
      .eq("paciente_id", pacienteId),
  ]);

  if (sessoesRes.error) throw sessoesRes.error;
  if (cobrancasRes.error) throw cobrancasRes.error;

  const sessoesPorMes = new Map<string, SessaoHistoricoRow[]>();
  for (const row of (sessoesRes.data ?? []) as SessaoHistoricoRow[]) {
    const [anoStr, mesStr] = row.data.split("-");
    const key = monthKey(Number(mesStr), Number(anoStr));
    const list = sessoesPorMes.get(key) ?? [];
    list.push(row);
    sessoesPorMes.set(key, list);
  }

  const cobrancaPorMes = new Map<string, CobrancaHistoricoRow>();
  for (const row of (cobrancasRes.data ?? []) as CobrancaHistoricoRow[]) {
    if (row.competencia_mes == null || row.competencia_ano == null) continue;
    cobrancaPorMes.set(monthKey(row.competencia_mes, row.competencia_ano), row);
  }

  return periodos.map((periodo) => {
    const key = monthKey(periodo.mes, periodo.ano);
    const cobranca = cobrancaPorMes.get(key);
    const frequenciaAtendimento = resolverFrequenciaExtrato(
      cobranca?.frequencia_atendimento,
      paciente.frequenciaAtendimento,
      null,
    );

    return {
      mes: periodo.mes,
      ano: periodo.ano,
      label: periodo.label,
      metrica: calcularMetricaComparecimento(sessoesPorMes.get(key) ?? [], {
        qtdSessoesCobranca: cobranca?.qtd_sessoes,
        frequenciaAtendimento,
      }),
    };
  });
}
