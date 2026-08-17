import { supabase } from "@/integrations/supabase/client";
import { syncConsultaExperimentalProntuario } from "@/lib/queries/prontuario";
import type {
  FormaPagamento,
  ModeloRelatorio,
  ModoEmissaoBoleto,
  ModoEmissaoNf,
  PacienteTipo,
  RegimeCobranca,
} from "../types";

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
  fisioterapeutaNome: string | null;
  numeroProcesso: string | null;
  advogadoNome: string | null;
  advogadoEmail: string | null;
  formaPagamentoPreferida: FormaPagamento | null;
  ativo: boolean;
  observacoes: string | null;
  motivoAcompanhamento: string | null;
  modoEmissaoNf: ModoEmissaoNf;
  diaEmissaoNf: number | null;
  modoEmissaoBoleto: ModoEmissaoBoleto;
  diaEmissaoBoleto: number | null;
  consultaExperimentalEm: string | null;
  consultaExperimentalFisioId: string | null;
  consultaExperimentalObservacoes: string | null;
  periodizacaoPdfUrl: string | null;
  planoTotalSessoes: number | null;
  consultaExperimentalFisioNome: string | null;
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
  motivo_acompanhamento: string | null;
  modo_emissao_nf: ModoEmissaoNf;
  dia_emissao_nf: number | null;
  modo_emissao_boleto: ModoEmissaoBoleto;
  dia_emissao_boleto: number | null;
  consulta_experimental_em: string | null;
  consulta_experimental_fisio_id: string | null;
  consulta_experimental_observacoes: string | null;
  periodizacao_pdf_url: string | null;
  plano_total_sessoes: number | null;
  created_at: string;
  convenios?: { nome: string } | null;
  fisioterapeutas?: { nome: string } | null;
  consulta_experimental_fisio?: { nome: string } | null;
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
  fisioterapeutaNome: r.fisioterapeutas?.nome ?? null,
  numeroProcesso: r.numero_processo,
  advogadoNome: r.advogado_nome,
  advogadoEmail: r.advogado_email,
  formaPagamentoPreferida: r.forma_pagamento_preferida,
  ativo: r.ativo,
  observacoes: r.observacoes,
  motivoAcompanhamento: r.motivo_acompanhamento,
  modoEmissaoNf: r.modo_emissao_nf ?? "automatico_pagamento",
  diaEmissaoNf: r.dia_emissao_nf,
  modoEmissaoBoleto: r.modo_emissao_boleto ?? "automatico_pagamento",
  diaEmissaoBoleto: r.dia_emissao_boleto,
  consultaExperimentalEm: r.consulta_experimental_em,
  consultaExperimentalFisioId: r.consulta_experimental_fisio_id,
  consultaExperimentalObservacoes: r.consulta_experimental_observacoes,
  periodizacaoPdfUrl: r.periodizacao_pdf_url,
  planoTotalSessoes: r.plano_total_sessoes,
  consultaExperimentalFisioNome: r.consulta_experimental_fisio?.nome ?? null,
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
    .select("*, convenios(nome), fisioterapeutas!fisioterapeuta_id(nome)")
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
    .select("*, convenios(nome), fisioterapeutas!fisioterapeuta_id(nome)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data ? map(data as unknown as Row) : null;
}

export async function updateConsultaExperimental(
  pacienteId: string,
  input: {
    consultaExperimentalEm: string | null;
    consultaExperimentalFisioId: string | null;
    consultaExperimentalObservacoes: string | null;
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("pacientes")
    .update({
      consulta_experimental_em: input.consultaExperimentalEm,
      consulta_experimental_fisio_id: input.consultaExperimentalFisioId,
      consulta_experimental_observacoes: input.consultaExperimentalObservacoes,
    })
    .eq("id", pacienteId);
  if (error) throw error;

  await syncConsultaExperimentalProntuario(pacienteId, input);
}

export async function updatePeriodizacaoPdfUrl(
  pacienteId: string,
  periodizacaoPdfUrl: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("set_periodizacao_pdf_url", {
    p_paciente_id: pacienteId,
    p_url: periodizacaoPdfUrl as unknown as string,
  });
  if (error) throw error;
}

const PERIODIZACAO_PDF_BUCKET = "periodizacao-pdf";

function periodizacaoPdfStoragePath(pacienteId: string): string {
  return `${pacienteId}/periodizacao.pdf`;
}

export async function uploadPeriodizacaoPdf(pacienteId: string, file: File): Promise<string> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Selecione um arquivo PDF.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("O PDF deve ter no máximo 10 MB.");
  }

  const path = periodizacaoPdfStoragePath(pacienteId);
  const { error: uploadError } = await supabase.storage
    .from(PERIODIZACAO_PDF_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(PERIODIZACAO_PDF_BUCKET).getPublicUrl(path);
  try {
    await updatePeriodizacaoPdfUrl(pacienteId, data.publicUrl);
  } catch (err) {
    await supabase.storage.from(PERIODIZACAO_PDF_BUCKET).remove([path]);
    throw err;
  }
  return data.publicUrl;
}

export async function removePeriodizacaoPdf(pacienteId: string): Promise<void> {
  const path = periodizacaoPdfStoragePath(pacienteId);
  const { error: removeError } = await supabase.storage
    .from(PERIODIZACAO_PDF_BUCKET)
    .remove([path]);
  if (removeError && !/not found/i.test(removeError.message)) throw removeError;
  await updatePeriodizacaoPdfUrl(pacienteId, null);
}

export async function createPaciente(
  input: Omit<Paciente, "id" | "createdAt" | "convenioNome">,
): Promise<Paciente> {
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
      motivo_acompanhamento: input.motivoAcompanhamento,
      modo_emissao_nf: input.modoEmissaoNf ?? "automatico_pagamento",
      dia_emissao_nf: input.diaEmissaoNf,
      modo_emissao_boleto: input.modoEmissaoBoleto ?? "automatico_pagamento",
      dia_emissao_boleto: input.diaEmissaoBoleto,
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

export async function setPacienteAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("pacientes").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export type PacienteDeleteBlockReason = {
  cobrancas: number;
  sessoes: number;
  agendamentos: number;
};

export async function checkPacienteDependencias(id: string): Promise<PacienteDeleteBlockReason> {
  const [cobrancas, sessoes, agendamentos] = await Promise.all([
    supabase.from("cobrancas").select("id", { count: "exact", head: true }).eq("paciente_id", id),
    supabase.from("sessoes").select("id", { count: "exact", head: true }).eq("paciente_id", id),
    supabase
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("paciente_id", id),
  ]);
  if (cobrancas.error) throw cobrancas.error;
  if (sessoes.error) throw sessoes.error;
  if (agendamentos.error) throw agendamentos.error;
  return {
    cobrancas: cobrancas.count ?? 0,
    sessoes: sessoes.count ?? 0,
    agendamentos: agendamentos.count ?? 0,
  };
}

export async function deletePaciente(id: string): Promise<void> {
  const deps = await checkPacienteDependencias(id);
  if (deps.cobrancas > 0 || deps.sessoes > 0 || deps.agendamentos > 0) {
    throw new Error(
      'Este paciente já tem histórico (cobranças, sessões ou agendamentos) e não pode ser excluído. Use "Inativar" para removê-lo das listas ativas sem perder o histórico.',
    );
  }
  const { error } = await supabase.from("pacientes").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePaciente(
  id: string,
  input: Partial<Omit<Paciente, "id" | "createdAt" | "convenioNome">>,
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
      motivo_acompanhamento: input.motivoAcompanhamento,
      modo_emissao_nf: input.modoEmissaoNf ?? "automatico_pagamento",
      dia_emissao_nf: input.diaEmissaoNf,
      modo_emissao_boleto: input.modoEmissaoBoleto ?? "automatico_pagamento",
      dia_emissao_boleto: input.diaEmissaoBoleto,
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
