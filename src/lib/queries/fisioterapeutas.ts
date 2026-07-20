import { supabase } from "@/integrations/supabase/client";
import { SIGLAS_REALIZADAS } from "@/lib/domain/frequencia";
import type { FrequenciaSigla } from "@/lib/types";

export type Fisio = {
  id: string;
  nome: string;
  registro_profissional: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
};

export type FisioFormValues = {
  nome: string;
  registro_profissional?: string | null;
  email?: string | null;
  ativo: boolean;
};

export type FisioMetrics = {
  totalConsultas: number;
  comparecimento: number | null;
  aderencia: number | null;
};

export async function fetchFisios(): Promise<Fisio[]> {
  const { data, error } = await supabase
    .from("fisioterapeutas")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Fisio[];
}

export async function upsertFisio(id: string | null, vals: FisioFormValues): Promise<void> {
  const payload = {
    nome: vals.nome,
    registro_profissional: vals.registro_profissional || null,
    email: vals.email || null,
    ativo: vals.ativo,
  };

  if (id) {
    const { error } = await supabase.from("fisioterapeutas").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("fisioterapeutas").insert(payload);
    if (error) throw error;
  }
}

export async function toggleFisioAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("fisioterapeutas").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function checkFisioDependencias(id: string): Promise<{ sessoes: number; agendamentos: number }> {
  const [sessoes, agendamentos] = await Promise.all([
    supabase.from("sessoes").select("id", { count: "exact", head: true }).eq("fisioterapeuta_id", id),
    supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("fisioterapeuta_id", id),
  ]);
  if (sessoes.error) throw sessoes.error;
  if (agendamentos.error) throw agendamentos.error;
  return { sessoes: sessoes.count ?? 0, agendamentos: agendamentos.count ?? 0 };
}

export async function deleteFisio(id: string): Promise<void> {
  const deps = await checkFisioDependencias(id);
  if (deps.sessoes > 0 || deps.agendamentos > 0) {
    throw new Error(
      "Este fisioterapeuta já tem sessões ou agendamentos vinculados e não pode ser excluído. Use o botão Ativo/Inativo para removê-lo das listas ativas sem perder o histórico.",
    );
  }
  const { error } = await supabase.from("fisioterapeutas").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchFisioMetrics(fisioId: string): Promise<FisioMetrics> {
  const { data, error } = await supabase
    .from("sessoes")
    .select("sigla")
    .eq("fisioterapeuta_id", fisioId);
  if (error) throw error;

  const rows = (data ?? []) as { sigla: FrequenciaSigla | null }[];
  const total = rows.length;
  if (total === 0) {
    return { totalConsultas: 0, comparecimento: null, aderencia: null };
  }

  const realizadas = rows.filter((r) => r.sigla && SIGLAS_REALIZADAS.includes(r.sigla)).length;
  const faltasNaoJustificadas = rows.filter((r) => r.sigla === "F" || r.sigla === "NJ").length;

  return {
    totalConsultas: total,
    comparecimento: realizadas / total,
    aderencia: (total - faltasNaoJustificadas) / total,
  };
}
