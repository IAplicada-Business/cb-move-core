import { supabase } from "@/integrations/supabase/client";
import { resolveMoveSessaoSiglaDia } from "@/lib/domain/frequencia";
import { resolverFrequenciaExtrato } from "@/lib/domain/atendimento-cadastro";
import {
  calcularMetricaComparecimento,
  type MetricaComparecimento,
} from "@/lib/domain/frequencia";
import { fetchPaciente } from "@/lib/queries/pacientes";
import type { FrequenciaSigla, PacienteTipo } from "@/lib/types";

export type SessaoGradeRow = {
  id: string;
  paciente_id: string;
  fisioterapeuta_id: string | null;
  data: string;
  sigla: FrequenciaSigla;
};

export type PacienteFreqGrade = {
  id: string;
  nome: string;
  tipo: PacienteTipo;
  fisioterapeuta_id: string | null;
  frequencia_atendimento: string | null;
  temAtividadeMes?: boolean;
};

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

export async function fetchSessoesGradeMensal(
  mes: number,
  ano: number,
): Promise<{
  pacientes: PacienteFreqGrade[];
  sessoes: SessaoGradeRow[];
  cobrancaPorPaciente: Record<string, number>;
}> {
  const { inicio, fim } = monthRange(mes, ano);

  const [sessoesRes, cobrancasRes] = await Promise.all([
    supabase
      .from("sessoes")
      .select(
        "id, paciente_id, fisioterapeuta_id, data, sigla, pacientes(id, nome, tipo, fisioterapeuta_id, frequencia_atendimento, ativo)",
      )
      .gte("data", inicio)
      .lt("data", fim),
    supabase
      .from("cobrancas")
      .select("paciente_id, qtd_sessoes")
      .eq("competencia_mes", mes)
      .eq("competencia_ano", ano),
  ]);

  if (sessoesRes.error) throw sessoesRes.error;
  if (cobrancasRes.error) throw cobrancasRes.error;

  type SessaoRow = {
    id: string;
    paciente_id: string;
    fisioterapeuta_id: string | null;
    data: string;
    sigla: FrequenciaSigla;
    pacientes: {
      id: string;
      nome: string;
      tipo: PacienteTipo;
      fisioterapeuta_id: string | null;
      frequencia_atendimento: string | null;
      ativo: boolean;
    } | null;
  };

  const rows = (sessoesRes.data ?? []) as unknown as SessaoRow[];

  /** Prioridade na célula: P/RC > F/FJ > NJ/NR (defensivo se houver duplicata). */
  const siglaRank: Record<FrequenciaSigla, number> = {
    P: 4,
    RC: 4,
    F: 3,
    FJ: 3,
    NJ: 2,
    NR: 1,
  };

  const cellMap = new Map<string, SessaoGradeRow>();
  const pacientesMap = new Map<string, PacienteFreqGrade>();

  for (const row of rows) {
    if (!row.paciente_id || !row.pacientes) continue;
    if (row.pacientes.ativo === false) continue;

    const key = `${row.paciente_id}|${row.data}`;
    const atual = cellMap.get(key);
    if (
      !atual ||
      (siglaRank[row.sigla] ?? 0) > (siglaRank[atual.sigla] ?? 0)
    ) {
      cellMap.set(key, {
        id: row.id,
        paciente_id: row.paciente_id,
        fisioterapeuta_id: row.fisioterapeuta_id ?? row.pacientes.fisioterapeuta_id,
        data: row.data,
        sigla: row.sigla,
      });
    }

    if (!pacientesMap.has(row.paciente_id)) {
      pacientesMap.set(row.paciente_id, {
        id: row.pacientes.id,
        nome: row.pacientes.nome,
        tipo: row.pacientes.tipo,
        fisioterapeuta_id: row.pacientes.fisioterapeuta_id,
        frequencia_atendimento: row.pacientes.frequencia_atendimento,
        temAtividadeMes: true,
      });
    }
  }

  const cobrancaPorPaciente: Record<string, number> = {};
  for (const row of cobrancasRes.data ?? []) {
    const id = (row as { paciente_id: string; qtd_sessoes: number | null }).paciente_id;
    const qtd = (row as { qtd_sessoes: number | null }).qtd_sessoes;
    if (id && qtd != null && qtd > 0 && cobrancaPorPaciente[id] == null) {
      cobrancaPorPaciente[id] = qtd;
    }
  }

  const sessoes = [...cellMap.values()];
  const pacientes = [...pacientesMap.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return { pacientes, sessoes, cobrancaPorPaciente };
}

/** Upsert de sigla por paciente + data (uma sessão por dia na planilha). */
export async function upsertSessaoSigla(input: {
  pacienteId: string;
  data: string;
  sigla: FrequenciaSigla;
  fisioterapeutaId?: string | null;
  hora?: string | null;
}): Promise<void> {
  const { data: existingRows, error: findError } = await supabase
    .from("sessoes")
    .select("id")
    .eq("paciente_id", input.pacienteId)
    .eq("data", input.data)
    .order("created_at", { ascending: true })
    .limit(1);
  if (findError) throw findError;

  const patch = {
    sigla: input.sigla,
    ...(input.fisioterapeutaId !== undefined ? { fisioterapeuta_id: input.fisioterapeutaId } : {}),
    ...(input.hora !== undefined ? { hora: input.hora } : {}),
  };

  const existingId = existingRows?.[0]?.id;
  if (existingId) {
    const { error } = await supabase.from("sessoes").update(patch).eq("id", existingId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("sessoes").insert({
    paciente_id: input.pacienteId,
    data: input.data,
    sigla: input.sigla,
    fisioterapeuta_id: input.fisioterapeutaId ?? null,
    hora: input.hora ?? null,
  });
  if (error) throw error;
}

export async function clearSessaoSigla(pacienteId: string, data: string): Promise<void> {
  const { error } = await supabase
    .from("sessoes")
    .delete()
    .eq("paciente_id", pacienteId)
    .eq("data", data);
  if (error) throw error;
}

/** Sigla registrada na planilha para paciente + dia (null se não houver). */
export async function fetchSessaoSiglaDia(
  pacienteId: string,
  data: string,
): Promise<FrequenciaSigla | null> {
  const { data: rows, error } = await supabase
    .from("sessoes")
    .select("sigla")
    .eq("paciente_id", pacienteId)
    .eq("data", data)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return (rows?.[0]?.sigla as FrequenciaSigla | undefined) ?? null;
}

/**
 * Move a sigla de frequência quando o agendamento muda de dia.
 * Se o dia destino já tiver marcação, só remove a antiga (não sobrescreve).
 */
export async function moveSessaoSiglaDia(input: {
  pacienteId: string;
  dataAntiga: string;
  dataNova: string;
  hora?: string | null;
  fisioterapeutaId?: string | null;
}): Promise<{ moved: boolean; clearedOnly: boolean }> {
  const siglaOrigem = await fetchSessaoSiglaDia(input.pacienteId, input.dataAntiga);
  const siglaDestino = await fetchSessaoSiglaDia(input.pacienteId, input.dataNova);
  const plano = resolveMoveSessaoSiglaDia({ siglaOrigem, siglaDestino });

  if (plano.acao === "none") return { moved: false, clearedOnly: false };

  await clearSessaoSigla(input.pacienteId, input.dataAntiga);
  if (plano.acao === "clear_only") return { moved: false, clearedOnly: true };

  await upsertSessaoSigla({
    pacienteId: input.pacienteId,
    data: input.dataNova,
    sigla: plano.sigla!,
    fisioterapeutaId: input.fisioterapeutaId,
    hora: input.hora,
  });
  return { moved: true, clearedOnly: false };
}

/** Atualiza hora/fisio da sigla existente no mesmo dia (remarcação só de horário). */
export async function atualizarSessaoSiglaHora(input: {
  pacienteId: string;
  data: string;
  hora?: string | null;
  fisioterapeutaId?: string | null;
}): Promise<boolean> {
  const sigla = await fetchSessaoSiglaDia(input.pacienteId, input.data);
  if (!sigla) return false;

  await upsertSessaoSigla({
    pacienteId: input.pacienteId,
    data: input.data,
    sigla,
    fisioterapeutaId: input.fisioterapeutaId,
    hora: input.hora,
  });
  return true;
}
