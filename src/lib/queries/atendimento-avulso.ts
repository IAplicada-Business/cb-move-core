import { supabase } from "@/integrations/supabase/client";

export type PacienteAtendimentoAvulso = {
  id: string;
  nome: string;
};

export type AtendimentoAvulsoResult = {
  agendamentoId: string;
  pacienteId: string;
  inicio: string;
};

export async function buscarPacientesAtendimentoAvulso(
  query: string,
): Promise<PacienteAtendimentoAvulso[]> {
  const { data, error } = await supabase.rpc("buscar_pacientes_atendimento_avulso", {
    p_query: query.trim(),
  });
  if (error) throw error;
  return (data ?? []) as PacienteAtendimentoAvulso[];
}

export async function registrarAtendimentoAvulso(
  pacienteId: string,
  inicio?: string,
): Promise<AtendimentoAvulsoResult> {
  const { data, error } = await supabase.rpc("registrar_atendimento_avulso", {
    p_paciente_id: pacienteId,
    p_inicio: inicio ?? new Date().toISOString(),
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Atendimento avulso não registrado");

  return {
    agendamentoId: row.agendamento_id,
    pacienteId: row.paciente_id,
    inicio: row.inicio,
  };
}
