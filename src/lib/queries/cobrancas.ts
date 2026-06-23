import { supabase } from "@/integrations/supabase/client";
import type { CobrancaStatus, PacienteTipo } from "../types";

export type Cobranca = {
  id: string;
  pacienteId: string;
  pacienteNome: string | null;
  descricao: string | null;
  valor: number;
  tipo: PacienteTipo;
  status: CobrancaStatus;
  vencimento: string | null;
  pagoEm: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  paciente_id: string;
  descricao: string | null;
  valor: number | string;
  tipo: PacienteTipo;
  status: CobrancaStatus;
  vencimento: string | null;
  pago_em: string | null;
  created_at: string;
  pacientes?: { nome: string } | null;
};

const map = (r: Row): Cobranca => ({
  id: r.id,
  pacienteId: r.paciente_id,
  pacienteNome: r.pacientes?.nome ?? null,
  descricao: r.descricao,
  valor: Number(r.valor) || 0,
  tipo: r.tipo,
  status: r.status,
  vencimento: r.vencimento,
  pagoEm: r.pago_em,
  createdAt: r.created_at,
});

export async function fetchRecentCobrancas(limit = 10): Promise<Cobranca[]> {
  const { data, error } = await supabase
    .from("cobrancas" as never)
    .select("*, pacientes(nome)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(map);
}

export async function fetchAllCobrancas(): Promise<Cobranca[]> {
  const { data, error } = await supabase
    .from("cobrancas" as never)
    .select("*, pacientes(nome)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(map);
}
