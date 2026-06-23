import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Exercicio = {
  id: string;
  paciente_id: string;
  fisioterapeuta_id: string | null;
  nome: string;
  descricao: string | null;
  midia_url: string | null;
  repeticoes: number | null;
  series: number | null;
  frequencia_semanal: number;
  ativo: boolean;
  created_at: string;
};

export type ExercicioRealizado = {
  id: string;
  exercicio_id: string;
  paciente_id: string;
  data: string;
  observacoes_paciente: string | null;
  realizado_em: string;
};

export async function fetchExercicios(pacienteId: string): Promise<Exercicio[]> {
  const { data, error } = await db
    .from("exercicios")
    .select("*")
    .eq("paciente_id", pacienteId)
    .eq("ativo", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchExerciciosRealizados(pacienteId: string, desde: string): Promise<ExercicioRealizado[]> {
  const { data, error } = await db
    .from("exercicios_realizados")
    .select("*")
    .eq("paciente_id", pacienteId)
    .gte("data", desde);
  if (error) throw error;
  return data ?? [];
}

export async function marcarExercicioFeito(payload: {
  exercicio_id: string;
  paciente_id: string;
  data: string;
  observacoes_paciente?: string;
}) {
  const { data, error } = await db.from("exercicios_realizados").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function criarExercicio(ex: Partial<Exercicio>) {
  const { data, error } = await db.from("exercicios").insert(ex).select().single();
  if (error) throw error;
  return data;
}
