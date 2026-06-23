import { supabase } from "@/integrations/supabase/client";
import type { FormaPagamento, PacienteTipo, RegimeCobranca } from "../types";

export type Paciente = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  tipo: PacienteTipo;
  regimeCobranca: RegimeCobranca;
  valorMensal: number | null;
  valorSessao: number | null;
  convenioId: string | null;
  fisioterapeutaId: string | null;
  numeroProcesso: string | null;
  advogadoNome: string | null;
  advogadoEmail: string | null;
  formaPagamentoPreferida: FormaPagamento | null;
  ativo: boolean;
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
  regime_cobranca: RegimeCobranca;
  valor_mensal: number | null;
  valor_sessao: number | null;
  convenio_id: string | null;
  fisioterapeuta_id: string | null;
  numero_processo: string | null;
  advogado_nome: string | null;
  advogado_email: string | null;
  forma_pagamento_preferida: FormaPagamento | null;
  ativo: boolean;
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
  regimeCobranca: r.regime_cobranca,
  valorMensal: r.valor_mensal,
  valorSessao: r.valor_sessao,
  convenioId: r.convenio_id,
  fisioterapeutaId: r.fisioterapeuta_id,
  numeroProcesso: r.numero_processo,
  advogadoNome: r.advogado_nome,
  advogadoEmail: r.advogado_email,
  formaPagamentoPreferida: r.forma_pagamento_preferida,
  ativo: r.ativo,
  observacoes: r.observacoes,
  createdAt: r.created_at,
});

export async function fetchPacientes(filters?: {
  tipo?: PacienteTipo;
  regime?: RegimeCobranca;
  ativo?: boolean;
  search?: string;
}): Promise<Paciente[]> {
  let query = supabase
    .from("pacientes")
    .select("*")
    .order("nome", { ascending: true });

  if (filters?.tipo) query = query.eq("tipo", filters.tipo);
  if (filters?.regime) query = query.eq("regime_cobranca", filters.regime);
  if (filters?.ativo !== undefined) query = query.eq("ativo", filters.ativo);

  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Row[]).map(map);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return rows.filter((p) => p.nome.toLowerCase().includes(q) || p.cpf?.includes(q));
  }
  return rows;
}

export async function fetchPaciente(id: string): Promise<Paciente | null> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data ? map(data as unknown as Row) : null;
}

export async function createPaciente(input: Omit<Paciente, "id" | "createdAt">): Promise<Paciente> {
  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      nome: input.nome,
      cpf: input.cpf,
      telefone: input.telefone,
      email: input.email,
      tipo: input.tipo,
      regime_cobranca: input.regimeCobranca,
      valor_mensal: input.valorMensal,
      valor_sessao: input.valorSessao,
      convenio_id: input.convenioId,
      fisioterapeuta_id: input.fisioterapeutaId,
      numero_processo: input.numeroProcesso,
      advogado_nome: input.advogadoNome,
      advogado_email: input.advogadoEmail,
      forma_pagamento_preferida: input.formaPagamentoPreferida,
      ativo: input.ativo,
      observacoes: input.observacoes,
    })
    .select("*")
    .single();
  if (error) throw error;
  return map(data as unknown as Row);
}

export async function updatePaciente(id: string, input: Partial<Omit<Paciente, "id" | "createdAt">>): Promise<void> {
  const { error } = await supabase
    .from("pacientes")
    .update({
      nome: input.nome,
      cpf: input.cpf,
      telefone: input.telefone,
      email: input.email,
      tipo: input.tipo,
      regime_cobranca: input.regimeCobranca,
      valor_mensal: input.valorMensal,
      valor_sessao: input.valorSessao,
      convenio_id: input.convenioId,
      fisioterapeuta_id: input.fisioterapeutaId,
      numero_processo: input.numeroProcesso,
      advogado_nome: input.advogadoNome,
      advogado_email: input.advogadoEmail,
      forma_pagamento_preferida: input.formaPagamentoPreferida,
      ativo: input.ativo,
      observacoes: input.observacoes,
    })
    .eq("id", id);
  if (error) throw error;
}
