import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo } from "../types";

export type Paciente = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  tipo: PacienteTipo;
  convenioId: string | null;
  observacoes: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  tipo: PacienteTipo;
  convenio_id: string | null;
  observacoes: string | null;
  created_at: string;
};

const map = (r: Row): Paciente => ({
  id: r.id,
  nome: r.nome,
  cpf: r.cpf,
  telefone: r.telefone,
  email: r.email,
  tipo: r.tipo,
  convenioId: r.convenio_id,
  observacoes: r.observacoes,
  createdAt: r.created_at,
});

export async function fetchPacientes(): Promise<Paciente[]> {
  const { data, error } = await supabase
    .from("pacientes" as never)
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(map);
}
