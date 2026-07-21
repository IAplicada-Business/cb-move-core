import { supabase } from "@/integrations/supabase/client";

export type PeriodizacaoStatus = "planejada" | "em_andamento" | "concluida" | "cancelada";

export type PeriodizacaoSessao = {
  id: string;
  pacienteId: string;
  numeroSessao: number;
  objetivo: string | null;
  atividadesPrevistas: string | null;
  status: PeriodizacaoStatus;
  sessaoId: string | null;
  updatedAt: string;
};

type Row = {
  id: string;
  paciente_id: string;
  numero_sessao: number;
  objetivo: string | null;
  atividades_previstas: string | null;
  status: PeriodizacaoStatus;
  sessao_id: string | null;
  updated_at: string;
};

const map = (r: Row): PeriodizacaoSessao => ({
  id: r.id,
  pacienteId: r.paciente_id,
  numeroSessao: r.numero_sessao,
  objetivo: r.objetivo,
  atividadesPrevistas: r.atividades_previstas,
  status: r.status,
  sessaoId: r.sessao_id,
  updatedAt: r.updated_at,
});

export async function fetchPeriodizacaoPaciente(pacienteId: string): Promise<PeriodizacaoSessao[]> {
  const { data, error } = await supabase
    .from("periodizacao_sessoes")
    .select("*")
    .eq("paciente_id", pacienteId)
    .order("numero_sessao", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(map);
}

export async function upsertPeriodizacaoItem(input: {
  id?: string;
  pacienteId: string;
  numeroSessao: number;
  objetivo?: string | null;
  atividadesPrevistas?: string | null;
  status?: PeriodizacaoStatus;
  sessaoId?: string | null;
}): Promise<PeriodizacaoSessao> {
  const payload = {
    paciente_id: input.pacienteId,
    numero_sessao: input.numeroSessao,
    objetivo: input.objetivo ?? null,
    atividades_previstas: input.atividadesPrevistas ?? null,
    status: input.status ?? "planejada",
    sessao_id: input.sessaoId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("periodizacao_sessoes")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    return map(data as Row);
  }

  const { data, error } = await supabase
    .from("periodizacao_sessoes")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return map(data as Row);
}

export async function deletePeriodizacaoItem(id: string): Promise<void> {
  const { error } = await supabase.from("periodizacao_sessoes").delete().eq("id", id);
  if (error) throw error;
}

export function proximoNumeroSessao(itens: PeriodizacaoSessao[]): number {
  if (itens.length === 0) return 1;
  return Math.max(...itens.map((i) => i.numeroSessao)) + 1;
}
