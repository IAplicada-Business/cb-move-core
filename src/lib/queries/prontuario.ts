import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { RELATORIO_PDF_BUCKET, resolveRelatorioStoragePath } from "@/lib/relatorio-pdf-url";
import {
  buildConsultaExperimentalEvolucao,
  CONSULTA_EXPERIMENTAL_SUBJETIVO,
  shouldSyncConsultaExperimentalProntuario,
} from "@/lib/domain/consulta-experimental-prontuario";
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
  assinado_em?: string | null;
  assinado_por?: string | null;
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
  xlsx_url: string | null;
  formato_arquivo: string | null;
  assinado: boolean;
  assinado_em: string | null;
  status?: string | null;
  assinatura_link?: string | null;
  clicksign_document_key?: string | null;
  modelo_pdf: string | null;
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
  xlsx_url?: string;
  formato_arquivo?: "pdf" | "xlsx" | "dual" | "docx";
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
  motivo_acompanhamento: string | null;
  modo_emissao_nf: Paciente["modoEmissaoNf"];
  dia_emissao_nf: number | null;
  modo_emissao_boleto: Paciente["modoEmissaoBoleto"];
  dia_emissao_boleto: number | null;
  consulta_experimental_em: string | null;
  consulta_experimental_fisio_id: string | null;
  consulta_experimental_observacoes: string | null;
  periodizacao_pdf_url: string | null;
  plano_total_sessoes: number | null;
  endereco: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_municipio_ibge: number | null;
  created_at: string;
  convenios?: { nome: string } | null;
  fisioterapeutas?: { nome: string } | null;
  consulta_experimental_fisio?: { nome: string } | null;
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
    endereco: r.endereco,
    numeroEndereco: r.numero_endereco,
    complemento: r.complemento,
    bairro: r.bairro,
    cep: r.cep,
    cidade: r.cidade,
    uf: r.uf,
    codigoMunicipioIbge: r.codigo_municipio_ibge,
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
    .select(
      "*, convenios(nome), fisioterapeutas!fisioterapeuta_id(nome), consulta_experimental_fisio:fisioterapeutas!consulta_experimental_fisio_id(nome)",
    )
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
    .select(
      "id, data, hora, sigla, observacoes, fisioterapeutas!sessoes_fisioterapeuta_id_fkey(nome)",
    )
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
    .select(
      "id, data, hora, sigla, observacoes, fisioterapeutas!sessoes_fisioterapeuta_id_fkey(nome)",
    )
    .eq("paciente_id", pacienteId)
    .eq("data", data)
    .order("hora", { ascending: true });
  if (error) throw error;
  return (rows ?? []) as unknown as SessaoProntuario[];
}

export async function fetchRelatoriosPaciente(pacienteId: string): Promise<RelatorioAtendimento[]> {
  const { data, error } = await supabase
    .from("relatorios_atendimento")
    .select(
      "id, paciente_id, modelo, competencia_mes, competencia_ano, pdf_url, xlsx_url, formato_arquivo, assinado, assinado_em, status, assinatura_link, clicksign_document_key, modelo_pdf, created_at",
    )
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

export async function fetchInstrumentosAplicados(
  pacienteId: string,
): Promise<InstrumentoAplicado[]> {
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
    .select(
      "*, fisioterapeutas!prontuario_evolucoes_fisioterapeuta_id_fkey(nome), sessoes(sigla, hora)",
    )
    .eq("paciente_id", pacienteId)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EvolucaoComRelacoes[];
}

export type EvolucaoInsert = Database["public"]["Tables"]["prontuario_evolucoes"]["Insert"];

export async function createEvolucao(ev: EvolucaoInsert): Promise<Evolucao> {
  const { data, error } = await supabase.from("prontuario_evolucoes").insert(ev).select().single();
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

export async function assinarEvolucao(evolucaoId: string): Promise<Evolucao> {
  const { data, error } = await supabase.rpc("assinar_evolucao", {
    p_evolucao_id: evolucaoId,
  });
  if (error) throw error;
  return data as Evolucao;
}

const ASSINATURA_BUCKET = "assinaturas-usuarios";

export function assinaturaStoragePath(userId: string): string {
  return `${userId}/assinatura.png`;
}

export async function fetchProfileAssinaturaPath(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("assinatura_storage_path")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const path = data?.assinatura_storage_path;
  return path?.trim() ? path : null;
}

export async function uploadProfileAssinatura(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem PNG, JPEG ou WebP.");
  }
  const path = assinaturaStoragePath(userId);
  const { error: uploadError } = await supabase.storage
    .from(ASSINATURA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ assinatura_storage_path: path })
    .eq("id", userId);
  if (profileError) throw profileError;

  return path;
}

export async function getProfileAssinaturaSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ASSINATURA_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** Espelha Primeira Consulta Experimental (pacientes) como evolução S/O/P no prontuário. */
export async function syncConsultaExperimentalProntuario(
  pacienteId: string,
  input: {
    consultaExperimentalEm: string | null;
    consultaExperimentalFisioId: string | null;
    consultaExperimentalObservacoes: string | null;
  },
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from("prontuario_evolucoes")
    .select("id")
    .eq("paciente_id", pacienteId)
    .eq("subjetivo", CONSULTA_EXPERIMENTAL_SUBJETIVO)
    .maybeSingle();
  if (findError) throw findError;

  if (!shouldSyncConsultaExperimentalProntuario(input)) {
    if (existing?.id) {
      const { error: deleteError } = await supabase
        .from("prontuario_evolucoes")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;
    }
    return;
  }

  let fisioNome: string | null = null;
  if (input.consultaExperimentalFisioId) {
    const { data: fisio, error: fisioError } = await supabase
      .from("fisioterapeutas")
      .select("nome")
      .eq("id", input.consultaExperimentalFisioId)
      .maybeSingle();
    if (fisioError) throw fisioError;
    fisioNome = fisio?.nome ?? null;
  }

  const content = buildConsultaExperimentalEvolucao({
    data: input.consultaExperimentalEm!.trim(),
    observacoes: input.consultaExperimentalObservacoes,
    fisioNome,
  });

  const payload = {
    data: content.data,
    fisioterapeuta_id: input.consultaExperimentalFisioId,
    subjetivo: content.subjetivo,
    objetivo: content.objetivo,
    plano: content.plano,
    transcricao_raw: null,
    fonte: "manual" as const,
  };

  if (existing?.id) {
    await updateEvolucao(existing.id, payload);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await createEvolucao({
    paciente_id: pacienteId,
    sessao_id: null,
    criado_por: user?.id ?? null,
    ...payload,
  });
}

export async function gerarRelatorioMensal(input: {
  pacienteId: string;
  mes: number;
  ano: number;
  modeloPdf?: "legado";
}): Promise<GerarRelatorioResult> {
  return invokeEdgeFunction<GerarRelatorioResult>(
    "gerar-relatorio-mensal",
    {
      paciente_id: input.pacienteId,
      mes: input.mes,
      ano: input.ano,
      ...(input.modeloPdf ? { modelo_pdf: input.modeloPdf } : {}),
    },
    { timeoutMs: 120_000 },
  );
}

export type GerarRelatorioLoteResult = {
  tipo: string;
  convenio_id: string | null;
  mes: number;
  ano: number;
  total: number;
  ok: number;
  erros: number;
  resultados: Array<{
    paciente_id: string;
    paciente_nome: string;
    status: "ok" | "erro";
    detalhe: string;
    pdf_url?: string;
    xlsx_url?: string;
    total_sessoes?: number;
  }>;
};

export async function gerarRelatorioMensalLote(input: {
  tipo: string;
  convenioId?: string;
  mes: number;
  ano: number;
}): Promise<GerarRelatorioLoteResult> {
  return invokeEdgeFunction<GerarRelatorioLoteResult>(
    "gerar-relatorio-mensal-lote",
    {
      tipo: input.tipo,
      convenio_id: input.convenioId ?? null,
      mes: input.mes,
      ano: input.ano,
    },
    { timeoutMs: 600_000 },
  );
}

export async function solicitarAssinaturaRelatorio(relatorioId: string): Promise<{
  aviso?: string;
  status?: string;
  assinatura_link?: string;
}> {
  return invokeEdgeFunction("sign-relatorio", { relatorio_id: relatorioId });
}

const RELATORIO_PDF_BUCKET_LOCAL = RELATORIO_PDF_BUCKET;

function relatorioDocumentoFisicoStoragePath(pacienteId: string, ano: number, mes: number): string {
  return `relatorio-${pacienteId}-${ano}-${String(mes).padStart(2, "0")}-documento-fisico.pdf`;
}

function storagePathFromRelatorioPublicUrl(pdfUrl: string): string | null {
  return resolveRelatorioStoragePath(pdfUrl);
}

async function removeRelatorioStorageFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(RELATORIO_PDF_BUCKET_LOCAL).remove(paths);
  if (error && !/not found/i.test(error.message)) throw error;
}

function assertPdfFile(file: File): void {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Selecione um arquivo PDF.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("O PDF deve ter no máximo 10 MB.");
  }
}

export async function uploadRelatorioAtendimentoPdf(
  pacienteId: string,
  mes: number,
  ano: number,
  file: File,
): Promise<string> {
  assertPdfFile(file);

  const path = relatorioDocumentoFisicoStoragePath(pacienteId, ano, mes);
  const { error: uploadError } = await supabase.storage
    .from(RELATORIO_PDF_BUCKET_LOCAL)
    .upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
    });
  if (uploadError) throw uploadError;

  try {
    const { error } = await supabase.rpc("import_relatorio_atendimento_pdf", {
      p_paciente_id: pacienteId,
      p_competencia_mes: mes,
      p_competencia_ano: ano,
      p_pdf_url: path,
    });
    if (error) throw error;
  } catch (err) {
    await supabase.storage.from(RELATORIO_PDF_BUCKET_LOCAL).remove([path]);
    throw err;
  }
  return path;
}

export async function removeRelatorioAtendimentoPdf(
  relatorioId: string,
  pacienteId: string,
  mes: number,
  ano: number,
): Promise<void> {
  const path = relatorioDocumentoFisicoStoragePath(pacienteId, ano, mes);
  await removeRelatorioStorageFiles([path]);

  const { error } = await supabase.rpc("set_relatorio_atendimento_pdf_url", {
    p_relatorio_id: relatorioId,
    p_pdf_url: null,
  });
  if (error) throw error;
}

export async function deleteRelatorioAtendimento(
  relatorio: RelatorioAtendimento,
  pacienteId: string,
): Promise<void> {
  const paths: string[] = [];
  if (relatorio.pdf_url) {
    const fromUrl = storagePathFromRelatorioPublicUrl(relatorio.pdf_url);
    if (fromUrl) paths.push(fromUrl);
  }
  if (relatorio.xlsx_url) {
    const fromUrl = storagePathFromRelatorioPublicUrl(relatorio.xlsx_url);
    if (fromUrl) paths.push(fromUrl);
  }
  if (relatorio.modelo_pdf === "documento_fisico") {
    paths.push(
      relatorioDocumentoFisicoStoragePath(
        pacienteId,
        relatorio.competencia_ano,
        relatorio.competencia_mes,
      ),
    );
  }
  await removeRelatorioStorageFiles([...new Set(paths)]);

  const { error } = await supabase.from("relatorios_atendimento").delete().eq("id", relatorio.id);
  if (error) throw error;
}
