import { supabase } from "@/integrations/supabase/client";
import {
  statusAgendamentoFromSigla,
  deveEspelharSiglaStatus,
  siglaEspelhoFromStatus,
  formatSiglaHistorico,
} from "@/lib/domain/frequencia";
import type { FrequenciaSigla, StatusAgendamento } from "@/lib/types";
import { upsertSessaoSigla, clearSessaoSigla, fetchSessaoSiglaDia } from "@/lib/queries/sessoes";

export type EscopoRemanejamento = "pontual" | "semana" | "serie_mes";

type AgendamentoRow = {
  id: string;
  paciente_id: string | null;
  fisioterapeuta_id: string | null;
  inicio: string;
  duracao_min: number;
  servico: string | null;
  status: StatusAgendamento;
  serie_id: string | null;
};

export type HistoricoRow = {
  id: string;
  agendamento_id: string;
  acao: "status" | "remanejamento";
  status_anterior: string | null;
  status_novo: string | null;
  inicio_anterior: string | null;
  inicio_novo: string | null;
  escopo: string | null;
  created_at: string;
};

const STATUS_ATIVOS: StatusAgendamento[] = ["agendado", "confirmado"];

function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function sameIsoWeek(a: Date, b: Date): boolean {
  return startOfIsoWeek(a).getTime() === startOfIsoWeek(b).getTime();
}

async function insertHistorico(row: {
  agendamento_id: string;
  acao: "status" | "remanejamento";
  status_anterior?: string | null;
  status_novo?: string | null;
  inicio_anterior?: string | null;
  inicio_novo?: string | null;
  escopo?: string | null;
  usuario_id?: string | null;
}) {
  const { error } = await supabase.from("agendamento_historico").insert(row);
  if (error) throw error;
}

export async function fetchAgendamentoHistorico(agendamentoId: string): Promise<HistoricoRow[]> {
  const ids = await coletarIdsHistorico(agendamentoId);

  const { data, error } = await supabase
    .from("agendamento_historico")
    .select("*")
    .in("agendamento_id", ids)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as HistoricoRow[];
}

async function coletarIdsHistorico(agendamentoId: string): Promise<string[]> {
  const ids = new Set<string>([agendamentoId]);
  let atual: string | null = agendamentoId;

  while (atual) {
    const agendamentoIdAtual = atual;
    const response = await supabase
      .from("agendamentos")
      .select("remarcado_de_id")
      .eq("id", agendamentoIdAtual)
      .maybeSingle();
    if (response.error) throw response.error;
    const row = response.data as { remarcado_de_id: string | null } | null;
    const anterior: string | null = row?.remarcado_de_id ?? null;
    if (!anterior || ids.has(anterior)) break;
    ids.add(anterior);
    atual = anterior;
  }

  return [...ids];
}

export async function updateAgendamentoStatus(
  id: string,
  status: StatusAgendamento,
  usuarioId?: string | null,
  statusAnterior?: StatusAgendamento,
  options?: { mirrorSessoes?: boolean; fisioterapeutaIdsExtra?: string[] },
): Promise<void> {
  const mirrorSessoes = options?.mirrorSessoes !== false;
  const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
  if (error) throw error;

  await insertHistorico({
    agendamento_id: id,
    acao: "status",
    status_anterior: statusAnterior ?? null,
    status_novo: status,
    usuario_id: usuarioId ?? null,
  });

  // Espelha na tabela sessoes (fonte única para Frequência e Prontuário)
  const { data: ag, error: agError } = await supabase
    .from("agendamentos")
    .select("paciente_id, fisioterapeuta_id, inicio")
    .eq("id", id)
    .maybeSingle();
  if (agError) throw agError;

  if (ag?.paciente_id && ag.inicio) {
    const data = ag.inicio.slice(0, 10);
    const hora = horaFromAgendamentoInicio(ag.inicio);

    if (mirrorSessoes) {
      if (status === "realizado" || status === "faltou") {
        const siglaAlvo = siglaEspelhoFromStatus(status)!;
        const siglaExistente = await fetchSessaoSiglaDia(ag.paciente_id, data);
        if (deveEspelharSiglaStatus(siglaExistente, siglaAlvo)) {
          await upsertSessaoSigla({
            pacienteId: ag.paciente_id,
            data,
            sigla: siglaAlvo,
            fisioterapeutaId: ag.fisioterapeuta_id,
            fisioterapeutaIdsExtra: options?.fisioterapeutaIdsExtra ?? [],
            hora,
          });
        }
      } else if (statusAnterior === "realizado" || statusAnterior === "faltou") {
        await clearSessaoSigla(ag.paciente_id, data);
      }
    }
  }
}

function horaFromAgendamentoInicio(inicio: string): string | null {
  const match = inicio.match(/T(\d{2}:\d{2})/);
  return match ? `${match[1]}:00` : null;
}

function filtrarPorEscopo(
  origem: AgendamentoRow,
  candidatos: AgendamentoRow[],
  escopo: EscopoRemanejamento,
): AgendamentoRow[] {
  if (escopo === "pontual") return [origem];

  const origemDate = new Date(origem.inicio);
  const fimMes = endOfMonth(origemDate);

  const filtrados = candidatos.filter((ag) => {
    if (ag.id === origem.id) return true;
    const agDate = new Date(ag.inicio);
    if (agDate < origemDate) return false;
    if (!STATUS_ATIVOS.includes(ag.status)) return false;
    if (escopo === "semana") return sameIsoWeek(agDate, origemDate);
    if (escopo === "serie_mes") return agDate <= fimMes;
    return false;
  });

  const map = new Map(filtrados.map((a) => [a.id, a]));
  map.set(origem.id, origem);
  return [...map.values()];
}

async function buscarCandidatosEscopo(
  origem: AgendamentoRow,
  escopo: EscopoRemanejamento,
): Promise<AgendamentoRow[]> {
  if (escopo === "pontual") return [origem];

  const { data, error } = await supabase
    .from("agendamentos")
    .select("id, paciente_id, fisioterapeuta_id, inicio, duracao_min, servico, status, serie_id")
    .eq("paciente_id", origem.paciente_id!)
    .gte("inicio", origem.inicio)
    .in("status", STATUS_ATIVOS);
  if (error) throw error;

  let candidatos = (data ?? []) as AgendamentoRow[];
  if (origem.serie_id) {
    candidatos = candidatos.filter((c) => c.serie_id === origem.serie_id);
  }

  return filtrarPorEscopo(origem, candidatos, escopo);
}

export async function contarEscopoRemanejamento(
  agendamentoId: string,
  escopo: EscopoRemanejamento,
): Promise<number> {
  const { data: origem, error } = await supabase
    .from("agendamentos")
    .select("id, paciente_id, fisioterapeuta_id, inicio, duracao_min, servico, status, serie_id")
    .eq("id", agendamentoId)
    .single();
  if (error) throw error;
  const afetados = await buscarCandidatosEscopo(origem as AgendamentoRow, escopo);
  return afetados.length;
}

type RemarcarLoteResult = {
  count: number;
  primeiro_novo_id: string | null;
  frequencia_perdida_count: number;
};

export async function remarcarAgendamento(params: {
  agendamentoId: string;
  novoInicio: string;
  novoFisioId?: string;
  duracaoMin?: number;
  escopo: EscopoRemanejamento;
  usuarioId?: string | null;
}): Promise<{ count: number; primeiroNovoId: string | null; frequenciaPerdidaCount: number }> {
  const { agendamentoId, novoInicio, novoFisioId, duracaoMin, escopo, usuarioId } = params;

  const { data, error } = await supabase.rpc("remarcar_agendamentos_lote", {
    p_agendamento_id: agendamentoId,
    p_novo_inicio: novoInicio,
    p_escopo: escopo,
    p_novo_fisio_id: novoFisioId,
    p_duracao_min: duracaoMin,
    p_usuario_id: usuarioId ?? undefined,
  });
  if (error) throw error;

  const result = data as RemarcarLoteResult | null;
  if (!result) throw new Error("Remarcação não retornou resultado");

  return {
    count: result.count,
    primeiroNovoId: result.primeiro_novo_id,
    frequenciaPerdidaCount: result.frequencia_perdida_count,
  };
}

/** Registra sigla na planilha de frequência (sessoes) a partir do agendamento. */
export async function registrarSiglaFrequencia(
  agendamentoId: string,
  sigla: FrequenciaSigla,
  usuarioId?: string | null,
): Promise<void> {
  const { data: ag, error } = await supabase
    .from("agendamentos")
    .select("id, paciente_id, fisioterapeuta_id, inicio, status")
    .eq("id", agendamentoId)
    .single();
  if (error) throw error;
  if (!ag?.paciente_id || !ag.inicio) throw new Error("Agendamento sem paciente");

  const data = ag.inicio.slice(0, 10);
  const hora = horaFromAgendamentoInicio(ag.inicio);
  const siglaAnterior = await fetchSessaoSiglaDia(ag.paciente_id, data);

  await upsertSessaoSigla({
    pacienteId: ag.paciente_id,
    data,
    sigla,
    fisioterapeutaId: ag.fisioterapeuta_id,
    hora,
  });

  if (siglaAnterior !== sigla) {
    await insertHistorico({
      agendamento_id: agendamentoId,
      acao: "status",
      status_anterior: siglaAnterior ? formatSiglaHistorico(siglaAnterior) : null,
      status_novo: formatSiglaHistorico(sigla),
      usuario_id: usuarioId ?? null,
    });
  }

  const statusAlvo = statusAgendamentoFromSigla(sigla);
  const anterior = ag.status as StatusAgendamento;
  const podeSyncStatus = ["agendado", "confirmado", "realizado", "faltou"].includes(anterior);

  if (podeSyncStatus && anterior !== statusAlvo) {
    await updateAgendamentoStatus(agendamentoId, statusAlvo, usuarioId, anterior, {
      mirrorSessoes: false,
    });
  }
}

export async function fetchAgendaAviso(data: string): Promise<string> {
  const { data: row, error } = await supabase
    .from("agenda_avisos")
    .select("texto")
    .eq("data", data)
    .maybeSingle();
  if (error) throw error;
  return String(row?.texto ?? "").trim();
}

export async function upsertAgendaAviso(data: string, texto: string): Promise<void> {
  const { error } = await supabase
    .from("agenda_avisos")
    .upsert(
      { data, texto: texto.trim(), updated_at: new Date().toISOString() },
      { onConflict: "data" },
    );
  if (error) throw error;
}

export type AgendamentoDetalhe = {
  id: string;
  paciente_id: string | null;
  fisioterapeuta_id: string | null;
  inicio: string;
  duracao_min: number;
  servico: string | null;
  status: StatusAgendamento;
  serie_id: string | null;
  pacientes?: { nome: string; tipo?: string } | null;
  fisioterapeutas?: { nome: string } | null;
};

export async function fetchAgendamentoPorId(id: string): Promise<AgendamentoDetalhe> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*, pacientes(nome, tipo), fisioterapeutas(nome)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as AgendamentoDetalhe;
}

export async function fetchAgendamentosPeriodo(
  inicio: string,
  fim: string,
): Promise<AgendamentoDetalhe[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*, pacientes(nome, tipo), fisioterapeutas(nome)")
    .gte("inicio", inicio)
    .lte("inicio", fim)
    .order("inicio");
  if (error) throw error;
  return (data ?? []) as unknown as AgendamentoDetalhe[];
}

/** Reutiliza série existente do paciente no mês ou cria nova. */
export async function resolverSerieIdPacienteMes(
  pacienteId: string,
  mes: number,
  ano: number,
): Promise<string> {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01T00:00:00-03:00`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}T23:59:59-03:00`;

  const { data, error } = await supabase
    .from("agendamentos")
    .select("serie_id")
    .eq("paciente_id", pacienteId)
    .not("serie_id", "is", null)
    .gte("inicio", inicio)
    .lte("inicio", fim)
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const existente = (data as { serie_id: string | null } | null)?.serie_id;
  return existente ?? crypto.randomUUID();
}
