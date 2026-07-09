import { supabase } from "@/integrations/supabase/client";
import type { StatusAgendamento } from "@/lib/types";

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
  const db = supabase as any;
  const { error } = await db.from("agendamento_historico").insert(row);
  if (error) throw error;
}

export async function fetchAgendamentoHistorico(agendamentoId: string): Promise<HistoricoRow[]> {
  const db = supabase as any;
  const { data, error } = await db
    .from("agendamento_historico")
    .select("*")
    .eq("agendamento_id", agendamentoId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as HistoricoRow[];
}

export async function updateAgendamentoStatus(
  id: string,
  status: StatusAgendamento,
  usuarioId?: string | null,
  statusAnterior?: StatusAgendamento,
): Promise<void> {
  const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
  if (error) throw error;

  await insertHistorico({
    agendamento_id: id,
    acao: "status",
    status_anterior: statusAnterior ?? null,
    status_novo: status,
    usuario_id: usuarioId ?? null,
  });
}

function filtrarPorEscopo(
  origem: AgendamentoRow,
  candidatos: AgendamentoRow[],
  escopo: EscopoRemanejamento,
): AgendamentoRow[] {
  if (escopo === "pontual") return [origem];

  const origemDate = new Date(origem.inicio);
  const fimMes = endOfMonth(origemDate);

  return candidatos.filter((ag) => {
    const agDate = new Date(ag.inicio);
    if (agDate < origemDate) return false;
    if (!STATUS_ATIVOS.includes(ag.status)) return false;
    if (escopo === "semana") return sameIsoWeek(agDate, origemDate);
    if (escopo === "serie_mes") return agDate <= fimMes;
    return false;
  });
}

export async function remarcarAgendamento(params: {
  agendamentoId: string;
  novoInicio: string;
  novoFisioId?: string;
  duracaoMin?: number;
  escopo: EscopoRemanejamento;
  usuarioId?: string | null;
}): Promise<number> {
  const { agendamentoId, novoInicio, novoFisioId, duracaoMin, escopo, usuarioId } = params;

  const { data: origem, error: origErr } = await supabase
    .from("agendamentos")
    .select("id, paciente_id, fisioterapeuta_id, inicio, duracao_min, servico, status, serie_id")
    .eq("id", agendamentoId)
    .single();
  if (origErr) throw origErr;
  if (!origem.paciente_id) throw new Error("Agendamento sem paciente");

  const origemRow = origem as AgendamentoRow;
  if (!STATUS_ATIVOS.includes(origemRow.status)) {
    throw new Error("Só é possível remarcar agendamentos ativos (agendado ou confirmado)");
  }

  const deltaMs = new Date(novoInicio).getTime() - new Date(origemRow.inicio).getTime();
  const fisioDestino = novoFisioId ?? origemRow.fisioterapeuta_id;
  const duracao = duracaoMin ?? origemRow.duracao_min;

  let afetados: AgendamentoRow[] = [origemRow];

  if (escopo !== "pontual" && origemRow.serie_id) {
    const { data: serieRows, error: serieErr } = await supabase
      .from("agendamentos")
      .select("id, paciente_id, fisioterapeuta_id, inicio, duracao_min, servico, status, serie_id")
      .eq("serie_id", origemRow.serie_id)
      .gte("inicio", origemRow.inicio);
    if (serieErr) throw serieErr;
    afetados = filtrarPorEscopo(origemRow, (serieRows ?? []) as AgendamentoRow[], escopo);
    if (!afetados.some((a) => a.id === origemRow.id)) {
      afetados = [origemRow, ...afetados];
    }
  }

  const db = supabase as any;
  let count = 0;

  for (const ag of afetados) {
    const novoInicioAg = new Date(new Date(ag.inicio).getTime() + deltaMs).toISOString();

    const { data: novo, error: insErr } = await db
      .from("agendamentos")
      .insert({
        paciente_id: ag.paciente_id,
        fisioterapeuta_id: fisioDestino,
        inicio: novoInicioAg,
        duracao_min: duracao,
        servico: ag.servico,
        status: "agendado",
        serie_id: ag.serie_id,
        remarcado_de_id: ag.id,
        canal_origem: "remanejamento",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { error: updErr } = await supabase
      .from("agendamentos")
      .update({ status: "remarcacao" as StatusAgendamento, remarcado_para_id: novo.id })
      .eq("id", ag.id);
    if (updErr) throw updErr;

    await insertHistorico({
      agendamento_id: ag.id,
      acao: "remanejamento",
      status_anterior: ag.status,
      status_novo: "remarcacao",
      inicio_anterior: ag.inicio,
      inicio_novo: novoInicioAg,
      escopo,
      usuario_id: usuarioId ?? null,
    });

    count += 1;
  }

  return count;
}
