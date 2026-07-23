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
  fisioterapeutaId: string | null;
  fisioterapeutaNome: string | null;
  driveDocUrl: string | null;
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
  fisioterapeuta_id: string | null;
  drive_doc_url: string | null;
  updated_at: string;
  fisioterapeutas?: { nome: string } | null;
};

const map = (r: Row): PeriodizacaoSessao => ({
  id: r.id,
  pacienteId: r.paciente_id,
  numeroSessao: r.numero_sessao,
  objetivo: r.objetivo,
  atividadesPrevistas: r.atividades_previstas,
  status: r.status,
  sessaoId: r.sessao_id,
  fisioterapeutaId: r.fisioterapeuta_id,
  fisioterapeutaNome: r.fisioterapeutas?.nome ?? null,
  driveDocUrl: r.drive_doc_url,
  updatedAt: r.updated_at,
});

export async function fetchPeriodizacaoPaciente(pacienteId: string): Promise<PeriodizacaoSessao[]> {
  const { data, error } = await supabase
    .from("periodizacao_sessoes")
    .select("*, fisioterapeutas!periodizacao_sessoes_fisioterapeuta_id_fkey(nome)")
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
  fisioterapeutaId?: string | null;
  driveDocUrl?: string | null;
}): Promise<PeriodizacaoSessao> {
  const payload = {
    paciente_id: input.pacienteId,
    numero_sessao: input.numeroSessao,
    objetivo: input.objetivo ?? null,
    atividades_previstas: input.atividadesPrevistas ?? null,
    status: input.status ?? "planejada",
    sessao_id: input.sessaoId ?? null,
    fisioterapeuta_id: input.fisioterapeutaId ?? null,
    drive_doc_url: input.driveDocUrl ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("periodizacao_sessoes")
      .update(payload)
      .eq("id", input.id)
      .select("*, fisioterapeutas!periodizacao_sessoes_fisioterapeuta_id_fkey(nome)")
      .single();
    if (error) throw error;
    return map(data as Row);
  }

  const { data, error } = await supabase
    .from("periodizacao_sessoes")
    .insert(payload)
    .select("*, fisioterapeutas!periodizacao_sessoes_fisioterapeuta_id_fkey(nome)")
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
