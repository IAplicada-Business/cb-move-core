import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queries/keys";
import {
  mapFisioUsoLogRows,
  clampFisioUsoLogsLimit,
  type FisioUsoLog,
} from "@/lib/domain/fisio-uso-logs";
import { SIGLAS_REALIZADAS } from "@/lib/domain/frequencia";
import type { FrequenciaSigla } from "@/lib/types";

export type { FisioUsoLog, FisioUsoLogCategoria } from "@/lib/domain/fisio-uso-logs";

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

export type FisioUltimaSessao = {
  id: string;
  data: string;
  sigla: string;
  pacienteNome: string | null;
};

export type FisioContaVinculada = {
  userId: string;
  email: string | null;
};

export async function fetchFisios(opts?: { ativosOnly?: boolean }): Promise<Fisio[]> {
  let q = supabase.from("fisioterapeutas").select("*").order("nome");
  if (opts?.ativosOnly) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Fisio[];
}

export async function fetchFisioByEmail(email: string): Promise<Fisio | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("fisioterapeutas")
    .select("*")
    .ilike("email", trimmed)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Fisio | null;
}

export function invalidateFisioListQueries(qc: {
  invalidateQueries: (opts: { queryKey: readonly unknown[] }) => void;
}) {
  void qc.invalidateQueries({ queryKey: queryKeys.fisioterapeutas.all });
  void qc.invalidateQueries({ queryKey: queryKeys.fisioterapeutas.ativos });
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

export async function checkFisioDependencias(
  id: string,
): Promise<{ sessoes: number; agendamentos: number }> {
  const [sessoes, agendamentos] = await Promise.all([
    supabase
      .from("sessoes")
      .select("id", { count: "exact", head: true })
      .eq("fisioterapeuta_id", id),
    supabase
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("fisioterapeuta_id", id),
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

export async function fetchFisioUltimasSessoes(
  fisioId: string,
  limit = 10,
): Promise<FisioUltimaSessao[]> {
  const { data, error } = await supabase
    .from("sessoes")
    .select("id, data, sigla, pacientes(nome)")
    .eq("fisioterapeuta_id", fisioId)
    .order("data", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      data: string;
      sigla: string;
      pacientes?: { nome: string } | null;
    };
    return {
      id: r.id,
      data: r.data,
      sigla: r.sigla,
      pacienteNome: r.pacientes?.nome ?? null,
    };
  });
}

export async function fetchFisioContaVinculada(
  fisioId: string,
): Promise<FisioContaVinculada | null> {
  const { data, error } = await supabase.rpc("get_fisio_conta_vinculada", {
    p_fisio_id: fisioId,
  });
  if (error) throw error;

  const row = (data as { user_id: string; email: string | null }[] | null)?.[0];
  if (!row) return null;
  return { userId: row.user_id, email: row.email };
}

export async function fetchFisioUsoLogs(fisioId: string, limit = 25): Promise<FisioUsoLog[]> {
  const { data, error } = await supabase.rpc("get_fisio_uso_logs", {
    p_fisio_id: fisioId,
    p_limit: clampFisioUsoLogsLimit(limit),
  });
  if (error) throw error;
  return mapFisioUsoLogRows((data ?? []) as Parameters<typeof mapFisioUsoLogRows>[0]);
}
