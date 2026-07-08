import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoConfigValue } from "./integracao-config.ts";

/** Porto Alegre / RS — IBGE */
export const POA_CODIGO_MUNICIPIO = 4314902;

/** LC 116 item 04.08 — Fisioterapia */
export const FISIOTERAPIA_CODIGO_TRIBUTACAO = "040802";

/** NBS 1.2301.92.00 — Serviços de fisioterapia */
export const FISIOTERAPIA_CODIGO_NBS = "123019200";

export type FocusNfeConfig = {
  token: string;
  ambiente: "homologacao" | "producao";
  cnpjPrestador: string;
  codigoMunicipio: number;
  codigoTributacao: string;
  codigoNbs: string;
  inscricaoMunicipal?: string;
  codigoOpcaoSimplesNacional: number;
};

export type NfForFocus = {
  id: string;
  tipo: string | null;
  valor: number | string;
  competencia_mes: number | null;
  competencia_ano: number | null;
  destinatario_nome: string | null;
  destinatario_documento: string | null;
  corpo_paciente_nome: string | null;
  corpo_paciente_cpf: string | null;
  corpo_numero_processo: string | null;
  corpo_total_sessoes: number | null;
};

export type FocusEmitResult = {
  ref: string;
  status: string;
  numero: string | null;
  pdfUrl: string | null;
  raw: Record<string, unknown>;
};

function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function baseUrl(ambiente: FocusNfeConfig["ambiente"]): string {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

function basicAuthHeader(token: string): string {
  return `Basic ${btoa(`${token}:`)}`;
}

export async function loadFocusNfeConfig(
  admin: SupabaseClient,
): Promise<FocusNfeConfig | null> {
  const token = await getIntegracaoConfigValue(admin, "FOCUSNFE_TOKEN");
  const cnpj = await getIntegracaoConfigValue(admin, "FOCUSNFE_CNPJ_PRESTADOR");
  if (!token || !cnpj) return null;

  const ambienteRaw = (await getIntegracaoConfigValue(admin, "FOCUSNFE_AMBIENTE")) ?? "homologacao";
  const ambiente = ambienteRaw === "producao" ? "producao" : "homologacao";

  const codigoTributacao =
    (await getIntegracaoConfigValue(admin, "FOCUSNFE_CODIGO_TRIBUTACAO")) ??
    FISIOTERAPIA_CODIGO_TRIBUTACAO;
  const codigoNbs =
    (await getIntegracaoConfigValue(admin, "FOCUSNFE_CODIGO_NBS")) ?? FISIOTERAPIA_CODIGO_NBS;
  const inscricaoMunicipal =
    (await getIntegracaoConfigValue(admin, "FOCUSNFE_INSCRICAO_MUNICIPAL")) ?? undefined;
  const simplesRaw = await getIntegracaoConfigValue(admin, "FOCUSNFE_SIMPLES_NACIONAL");
  const codigoOpcaoSimplesNacional = simplesRaw ? Number(simplesRaw) : 1;

  return {
    token,
    ambiente,
    cnpjPrestador: onlyDigits(cnpj),
    codigoMunicipio: POA_CODIGO_MUNICIPIO,
    codigoTributacao,
    codigoNbs,
    inscricaoMunicipal: inscricaoMunicipal ? onlyDigits(inscricaoMunicipal) : undefined,
    codigoOpcaoSimplesNacional: Number.isFinite(codigoOpcaoSimplesNacional)
      ? codigoOpcaoSimplesNacional
      : 1,
  };
}

function competenciaDate(nf: NfForFocus): string {
  const mes = nf.competencia_mes ?? new Date().getMonth() + 1;
  const ano = nf.competencia_ano ?? new Date().getFullYear();
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

function buildDescricaoServico(nf: NfForFocus): string {
  const comp = nf.competencia_mes && nf.competencia_ano
    ? `${String(nf.competencia_mes).padStart(2, "0")}/${nf.competencia_ano}`
    : "";

  if (nf.tipo === "judicial") {
    const partes = [
      "Serviços de fisioterapia neurofuncional",
      nf.corpo_paciente_nome ? `Paciente: ${nf.corpo_paciente_nome}` : null,
      nf.corpo_paciente_cpf ? `CPF: ${nf.corpo_paciente_cpf}` : null,
      nf.corpo_numero_processo ? `Processo: ${nf.corpo_numero_processo}` : null,
      nf.corpo_total_sessoes != null ? `Sessões: ${nf.corpo_total_sessoes}` : null,
      comp ? `Competência: ${comp}` : null,
    ].filter(Boolean);
    return partes.join(" | ");
  }

  const paciente = nf.corpo_paciente_nome ?? nf.destinatario_nome ?? "Paciente";
  return [
    "Serviços de fisioterapia neurofuncional",
    `Paciente: ${paciente}`,
    comp ? `Competência: ${comp}` : null,
  ].filter(Boolean).join(" | ");
}

export function buildFocusNfsenPayload(
  nf: NfForFocus,
  config: FocusNfeConfig,
): Record<string, unknown> {
  const now = new Date();
  const offset = "-03:00";
  const dataEmissao = now.toISOString().slice(0, 19) + offset;
  const doc = onlyDigits(nf.destinatario_documento);
  const valor = Number(nf.valor) || 0;

  const payload: Record<string, unknown> = {
    data_emissao: dataEmissao,
    data_competencia: competenciaDate(nf),
    codigo_municipio_emissora: config.codigoMunicipio,
    cnpj_prestador: config.cnpjPrestador,
    codigo_opcao_simples_nacional: config.codigoOpcaoSimplesNacional,
    regime_especial_tributacao: 0,
    codigo_municipio_prestacao: String(config.codigoMunicipio),
    codigo_tributacao_nacional_iss: config.codigoTributacao,
    codigo_nbs: config.codigoNbs,
    descricao_servico: buildDescricaoServico(nf).slice(0, 2000),
    valor_servico: valor,
    tributacao_iss: 1,
    tipo_retencao_iss: 1,
    situacao_tributaria_pis_cofins: "00",
  };

  if (config.inscricaoMunicipal) {
    payload.inscricao_municipal_prestador = config.inscricaoMunicipal;
  }

  if (doc.length === 11) {
    payload.cpf_tomador = doc;
    if (nf.destinatario_nome) payload.razao_social_tomador = nf.destinatario_nome;
  } else if (doc.length === 14) {
    payload.cnpj_tomador = doc;
    if (nf.destinatario_nome) payload.razao_social_tomador = nf.destinatario_nome;
    payload.codigo_municipio_tomador = config.codigoMunicipio;
  } else {
    throw new Error("Destinatário sem CPF/CNPJ válido para emissão automática");
  }

  return payload;
}

async function focusRequest(
  config: FocusNfeConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `${baseUrl(config.ambiente)}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: basicAuthHeader(config.token),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Focus NFe resposta inválida (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const msg = String(data.mensagem ?? data.erro ?? data.message ?? text).slice(0, 500);
    throw new Error(`Focus NFe ${res.status}: ${msg}`);
  }

  return data;
}

function extractNumero(data: Record<string, unknown>): string | null {
  const candidates = [
    data.numero,
    data.numero_nfse,
    data.numero_rps,
    data.numero_nfsen,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c);
  }
  return null;
}

function extractPdfUrl(data: Record<string, unknown>): string | null {
  const candidates = [
    data.url_danfse,
    data.url,
    data.caminho_danfse,
    data.caminho_pdf_nfsen,
    data.url_pdf,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return null;
}

function isAuthorized(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("autoriz") && !s.includes("erro");
}

function isError(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("erro") || s.includes("deneg") || s.includes("cancel");
}

export async function emitFocusNfsen(
  config: FocusNfeConfig,
  ref: string,
  nf: NfForFocus,
): Promise<FocusEmitResult> {
  const payload = buildFocusNfsenPayload(nf, config);
  await focusRequest(config, "POST", `/v2/nfsen?ref=${encodeURIComponent(ref)}`, payload);

  const maxAttempts = 15;
  const delayMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const data = await focusRequest(config, "GET", `/v2/nfsen/${encodeURIComponent(ref)}`);
    const status = String(data.status ?? "processando");

    if (isAuthorized(status)) {
      return {
        ref,
        status,
        numero: extractNumero(data),
        pdfUrl: extractPdfUrl(data),
        raw: data,
      };
    }

    if (isError(status)) {
      const msg = String(
        data.mensagem_sefaz ?? data.erros ?? data.mensagem ?? "Erro na autorização NFS-e",
      );
      throw new Error(`Focus NFe rejeitou: ${msg}`);
    }
  }

  throw new Error("Focus NFe: tempo esgotado aguardando autorização da NFS-e");
}

export async function uploadPdfFromUrl(
  admin: SupabaseClient,
  pdfUrl: string,
  storagePath: string,
): Promise<string> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Falha ao baixar PDF Focus (${res.status})`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const { error } = await admin.storage.from("notas-fiscais").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw error;

  const { data } = admin.storage.from("notas-fiscais").getPublicUrl(storagePath);
  return data.publicUrl;
}
