import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import type { Paciente } from "@/lib/queries/pacientes";
import type { FrequenciaSigla, ModeloRelatorio } from "../types";

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
  criado_por?: string | null;
  created_at: string;
};

export type FisioterapeutaOption = { id: string; nome: string };

export type PacienteOption = { id: string; nome: string };

export type ProntuarioPaciente = Paciente & {
  fisioterapeutaNome: string | null;
};

export type SessaoProntuario = {
  id: string;
  data: string;
  hora: string | null;
  sigla: FrequenciaSigla;
  observacoes: string | null;
  fisioterapeutas?: { nome: string } | null;
};

export type RelatorioAtendimento = {
  id: string;
  paciente_id: string;
  modelo: ModeloRelatorio;
  competencia_mes: number;
  competencia_ano: number;
  pdf_url: string | null;
  assinado: boolean;
  assinado_em: string | null;
  created_at: string;
};

export type InstrumentoCampo = {
  id: string;
  label: string;
  tipo: "select" | "number" | "textarea" | "text";
  opcoes?: string[];
  min?: number;
  max?: number;
};

export type InstrumentoClinico = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  versao: number;
  status: string;
  campos: InstrumentoCampo[];
};

export type InstrumentoAplicado = {
  id: string;
  instrumento_id: string;
  aplicado_em: string;
  resultados: Record<string, unknown>;
  instrumentos_clinicos?: { nome: string; codigo: string } | null;
};

export type GerarRelatorioResult = {
  relatorio_id?: string;
  competencia: string;
  total_sessoes: number;
  aviso?: string;
  pdf_url?: string;
};

type PacienteProntuarioRow = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  tipo: Paciente["tipo"];
  regime_cobranca: Paciente["regimeCobranca"];
  modelo_relatorio_preferido: Paciente["modeloRelatorio"];
  valor_mensal: number | null;
  valor_sessao: number | null;
  frequencia_atendimento: string | null;
  dias_semana: string | null;
  convenio_id: string | null;
  fisioterapeuta_id: string | null;
  numero_processo: string | null;
  advogado_nome: string | null;
  advogado_email: string | null;
  forma_pagamento_preferida: Paciente["formaPagamentoPreferida"];
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  convenios?: { nome: string } | null;
  fisioterapeutas?: { nome: string } | null;
};

function mapPacienteProntuario(r: PacienteProntuarioRow): ProntuarioPaciente {
  return {
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
    fisioterapeutaNome: r.fisioterapeutas?.nome ?? null,
    numeroProcesso: r.numero_processo,
    advogadoNome: r.advogado_nome,
    advogadoEmail: r.advogado_email,
    formaPagamentoPreferida: r.forma_pagamento_preferida,
    ativo: r.ativo,
    observacoes: r.observacoes,
    createdAt: r.created_at,
  };
}

export async function searchPacientesProntuario(q: string): Promise<PacienteOption[]> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nome")
    .ilike("nome", `%${q}%`)
    .order("nome")
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPacienteProntuario(id: string): Promise<ProntuarioPaciente | null> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("*, convenios(nome), fisioterapeutas(nome)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data ? mapPacienteProntuario(data as unknown as PacienteProntuarioRow) : null;
}

export async function savePacienteObservacoes(id: string, observacoes: string): Promise<void> {
  const { error } = await supabase
    .from("pacientes")
    .update({ observacoes: observacoes || null })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchSessoesProntuario(pacienteId: string): Promise<SessaoProntuario[]> {
  const { data, error } = await supabase
    .from("sessoes")
    .select("id, data, hora, sigla, observacoes, fisioterapeutas(nome)")
    .eq("paciente_id", pacienteId)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SessaoProntuario[];
}

export async function fetchSessoesDoDia(
  pacienteId: string,
  data: string,
): Promise<SessaoProntuario[]> {
  const { data: rows, error } = await supabase
    .from("sessoes")
    .select("id, data, hora, sigla, observacoes, fisioterapeutas(nome)")
    .eq("paciente_id", pacienteId)
    .eq("data", data)
    .order("hora", { ascending: true });
  if (error) throw error;
  return (rows ?? []) as unknown as SessaoProntuario[];
}

export async function fetchRelatoriosPaciente(pacienteId: string): Promise<RelatorioAtendimento[]> {
  const { data, error } = await supabase
    .from("relatorios_atendimento")
    .select("id, paciente_id, modelo, competencia_mes, competencia_ano, pdf_url, assinado, assinado_em, created_at")
    .eq("paciente_id", pacienteId)
    .order("competencia_ano", { ascending: false })
    .order("competencia_mes", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RelatorioAtendimento[];
}

export async function fetchInstrumentosAtivos(): Promise<InstrumentoClinico[]> {
  const { data, error } = await supabase
    .from("instrumentos_clinicos")
    .select("id, codigo, nome, categoria, versao, status, campos")
    .eq("status", "ativo")
    .order("categoria")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as unknown as InstrumentoClinico[];
}

export async function fetchInstrumentosAplicados(pacienteId: string): Promise<InstrumentoAplicado[]> {
  const { data, error } = await supabase
    .from("instrumentos_aplicados")
    .select("id, instrumento_id, aplicado_em, resultados, instrumentos_clinicos(nome, codigo)")
    .eq("paciente_id", pacienteId)
    .order("aplicado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InstrumentoAplicado[];
}

export async function aplicarInstrumento(input: {
  pacienteId: string;
  instrumentoId: string;
  versao: number;
  resultados: Record<string, string>;
  aplicadoPor?: string;
}): Promise<void> {
  const { error } = await supabase.from("instrumentos_aplicados").insert({
    paciente_id: input.pacienteId,
    instrumento_id: input.instrumentoId,
    versao_aplicada: input.versao,
    resultados: input.resultados,
    aplicado_por: input.aplicadoPor ?? null,
    aplicado_em: new Date().toISOString(),
  });
  if (error) throw error;
}

export type StatusHistorico = {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  alterado_em: string;
};

export async function fetchHistoricoStatus(pacienteId: string): Promise<StatusHistorico[]> {
  const { data, error } = await supabase
    .from("pacientes_status_historico")
    .select("id, campo, valor_anterior, valor_novo, alterado_em")
    .eq("paciente_id", pacienteId)
    .order("alterado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StatusHistorico[];
}

export async function fetchFisioterapeutasAtivos(): Promise<FisioterapeutaOption[]> {
  const { data, error } = await supabase
    .from("fisioterapeutas")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as FisioterapeutaOption[];
}

export type EvolucaoComRelacoes = Evolucao & {
  fisioterapeutas?: { nome: string } | null;
  sessoes?: { sigla: FrequenciaSigla; hora: string | null } | null;
};

export async function fetchEvolucoes(pacienteId: string): Promise<EvolucaoComRelacoes[]> {
  const { data, error } = await supabase
    .from("prontuario_evolucoes")
    .select("*, fisioterapeutas(nome), sessoes(sigla, hora)")
    .eq("paciente_id", pacienteId)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EvolucaoComRelacoes[];
}

export type EvolucaoInsert = Database["public"]["Tables"]["prontuario_evolucoes"]["Insert"];

export async function createEvolucao(ev: EvolucaoInsert): Promise<Evolucao> {
  const { data, error } = await supabase
    .from("prontuario_evolucoes")
    .insert(ev)
    .select()
    .single();
  if (error) throw error;
  return data as Evolucao;
}

export async function updateEvolucao(id: string, ev: Partial<Evolucao>): Promise<Evolucao> {
  const { data, error } = await supabase
    .from("prontuario_evolucoes")
    .update({ ...ev, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Evolucao;
}

export async function gerarRelatorioMensal(input: {
  pacienteId: string;
  mes: number;
  ano: number;
}): Promise<GerarRelatorioResult> {
  return invokeEdgeFunction<GerarRelatorioResult>("gerar-relatorio-mensal", {
    paciente_id: input.pacienteId,
    mes: input.mes,
    ano: input.ano,
  });
}

export async function solicitarAssinaturaRelatorio(relatorioId: string): Promise<{
  aviso?: string;
  status?: string;
  assinatura_link?: string;
}> {
  return invokeEdgeFunction("sign-relatorio", { relatorio_id: relatorioId });
}
