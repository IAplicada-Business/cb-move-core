// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase } from "@/integrations/supabase/client";

export type Evolucao = {
  id: string;
  paciente_id: string;
  fisioterapeuta_id: string | null;
  sessao_id: string | null;
  data: string;
  subjetivo: string | null;
  objetivo: string | null;
  plano: string | null;
  transcricao_raw: string | null;
  fonte: "manual" | "audio_ia" | "sites_import";
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function fetchEvolucoes(pacienteId: string): Promise<Evolucao[]> {
  const { data, error } = await db
    .from("prontuario_evolucoes")
    .select("*, fisioterapeutas(nome)")
    .eq("paciente_id", pacienteId)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Evolucao[];
}

export async function createEvolucao(ev: Partial<Evolucao>): Promise<Evolucao> {
  const { data, error } = await db
    .from("prontuario_evolucoes")
    .insert(ev)
    .select()
    .single();
  if (error) throw error;
  return data as Evolucao;
}

export async function updateEvolucao(id: string, ev: Partial<Evolucao>): Promise<Evolucao> {
  const { data, error } = await db
    .from("prontuario_evolucoes")
    .update({ ...ev, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Evolucao;
}
