import { supabase } from "@/integrations/supabase/client";
import type { FormaPagamento, ModeloRelatorio, PacienteTipo, RegimeCobranca } from "../types";

export type Paciente = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  tipo: PacienteTipo;
  regimeCobranca: RegimeCobranca;
  modeloRelatorio: ModeloRelatorio | null;
  valorMensal: number | null;
  valorSessao: number | null;
  frequenciaAtendimento: string | null;
  diasSemana: string | null;
  convenioId: string | null;
  convenioNome: string | null;
  fisioterapeutaId: string | null;
  numeroProcesso: string | null;
  advogadoNome: string | null;
  advogadoEmail: string | null;
  formaPagamentoPreferida: FormaPagamento | null;
  ativo: boolean;
  observacoes: string | null;
  createdAt: string;
  /** Usado na emissão de NFS-e para tomador particular (endereço do próprio paciente). */
  endereco: string | null;
  numeroEndereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  codigoMunicipioIbge: number | null;
};

type Row = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  tipo: PacienteTipo;
  regime_cobranca: RegimeCobranca;
  modelo_relatorio_preferido: ModeloRelatorio | null;
  valor_mensal: number | null;
  valor_sessao: number | null;
  frequencia_atendimento: string | null;
  dias_semana: string | null;
  convenio_id: string | null;
  fisioterapeuta_id: string | null;
  numero_processo: string | null;
  advogado_nome: string | null;
  advogado_email: string | null;
  forma_pagamento_preferida: FormaPagamento | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  convenios?: { nome: string } | null;
  endereco: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_municipio_ibge: number | null;
};

const map = (r: Row): Paciente => ({
  id: r.id,
  nome: r.nome,
  cpf: r.cpf,
  telefone: r.telefone,
  email: r.email,
  tipo: r.tipo,
  regimeCobranca: r.regime_cobranca,
  modeloRelatorio: r.modelo_relatorio_preferido,
  valorMensal: r.valor_mensal,
  valorSessao: r.valor_sessao,
  frequenciaAtendimento: r.frequencia_atendimento,
  diasSemana: r.dias_semana,
  convenioId: r.convenio_id,
  convenioNome: r.convenios?.nome ?? null,
  fisioterapeutaId: r.fisioterapeuta_id,
  numeroProcesso: r.numero_processo,
  advogadoNome: r.advogado_nome,
  advogadoEmail: r.advogado_email,
  formaPagamentoPreferida: r.forma_pagamento_preferida,
  ativo: r.ativo,
  observacoes: r.observacoes,
  createdAt: r.created_at,
  endereco: r.endereco,
  numeroEndereco: r.numero_endereco,
  complemento: r.complemento,
  bairro: r.bairro,
  cep: r.cep,
  cidade: r.cidade,
  uf: r.uf,
  codigoMunicipioIbge: r.codigo_municipio_ibge,
});

export async function fetchPacientes(filters?: {
  tipo?: PacienteTipo;
  regime?: RegimeCobranca;
  ativo?: boolean;
  search?: string;
}): Promise<Paciente[]> {
  let query = supabase
    .from("pacientes")
    .select("*, convenios(nome)")
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
    .select("*, convenios(nome)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data ? map(data as unknown as Row) : null;
}

export async function createPaciente(input: Omit<Paciente, "id" | "createdAt" | "convenioNome">): Promise<Paciente> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("pacientes")
    .insert({
      nome: input.nome,
      cpf: input.cpf,
      telefone: input.telefone,
      email: input.email,
      tipo: input.tipo,
      regime_cobranca: input.regimeCobranca,
      modelo_relatorio_preferido: input.modeloRelatorio ?? null,
      valor_mensal: input.valorMensal,
      valor_sessao: input.valorSessao,
      frequencia_atendimento: input.frequenciaAtendimento,
      dias_semana: input.diasSemana,
      convenio_id: input.convenioId,
      fisioterapeuta_id: input.fisioterapeutaId,
      numero_processo: input.numeroProcesso,
      advogado_nome: input.advogadoNome,
      advogado_email: input.advogadoEmail,
      forma_pagamento_preferida: input.formaPagamentoPreferida ?? null,
      ativo: input.ativo,
      observacoes: input.observacoes,
      endereco: input.endereco,
      numero_endereco: input.numeroEndereco,
      complemento: input.complemento,
      bairro: input.bairro,
      cep: input.cep,
      cidade: input.cidade,
      uf: input.uf,
      codigo_municipio_ibge: input.codigoMunicipioIbge,
    })
    .select("*, convenios(nome)")
    .single();
  if (error) throw error;
  return map(data as unknown as Row);
}

export async function updatePaciente(
  id: string,
  input: Partial<Omit<Paciente, "id" | "createdAt" | "convenioNome">>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("pacientes")
    .update({
      nome: input.nome,
      cpf: input.cpf,
      telefone: input.telefone,
      email: input.email,
      tipo: input.tipo,
      regime_cobranca: input.regimeCobranca,
      modelo_relatorio_preferido: input.modeloRelatorio ?? null,
      valor_mensal: input.valorMensal,
      valor_sessao: input.valorSessao,
      frequencia_atendimento: input.frequenciaAtendimento,
      dias_semana: input.diasSemana,
      convenio_id: input.convenioId,
      fisioterapeuta_id: input.fisioterapeutaId,
      numero_processo: input.numeroProcesso,
      advogado_nome: input.advogadoNome,
      advogado_email: input.advogadoEmail,
      forma_pagamento_preferida: input.formaPagamentoPreferida ?? null,
      ativo: input.ativo,
      observacoes: input.observacoes,
      endereco: input.endereco,
      numero_endereco: input.numeroEndereco,
      complemento: input.complemento,
      bairro: input.bairro,
      cep: input.cep,
      cidade: input.cidade,
      uf: input.uf,
      codigo_municipio_ibge: input.codigoMunicipioIbge,
    })
    .eq("id", id);
  if (error) throw error;
}
