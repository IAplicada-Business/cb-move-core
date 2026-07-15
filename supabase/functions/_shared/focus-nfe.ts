import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoConfigValue } from "./integracao-config.ts";
import { queueNfEmail } from "./nf-email-queue.ts";

export const FOCUS_REF_PREFIX = "cbmove-";

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
  /** 1=não optante, 2=MEI, 3=ME/EPP */
  codigoOpcaoSimplesNacional: number;
  /** 1=fed+mun SN, 2=fed SN + ISS fora, 3=fora do SN — obrigatório se ME/EPP */
  regimeTributarioSimplesNacional?: number;
  /** pTotTribSN (%) — obrigatório se ME/EPP */
  percentualTotalTributosSimples?: number;
};

export type TomadorForFocus = {
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
  codigo_municipio_ibge?: number | null;
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
  /** Ex.: "02, 06, 09, 13, 16, 20, 23, 27 E 30" */
  corpo_dias_atendidos?: string | null;
  /** Ex.: "1H 25 MINUTOS" — default 1 sessão simples */
  duracao_sessao?: string | null;
  /** simples | duplo | triplo | quadruplo — afeta texto "SESSÕES SIMPLES" e duração */
  tipo_sessao?: string | null;
  /** Valor unitário da sessão na discriminação (judicial / particular) */
  valor_sessao?: number | null;
  /** Linha de exceção com asterisco, ex.: "*SESSÃO DE 4H 25 MINUTOS DE DURAÇÃO." */
  observacao_excecoes?: string | null;
  fisio_nome?: string | null;
  fisio_crefito?: string | null;
  tomador?: TomadorForFocus | null;
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
  const codigoOpcaoSimplesNacional = simplesRaw ? Number(simplesRaw) : 3;
  const regimeSnRaw = await getIntegracaoConfigValue(
    admin,
    "FOCUSNFE_REGIME_TRIBUTARIO_SN",
  );
  const percentualSnRaw = await getIntegracaoConfigValue(
    admin,
    "FOCUSNFE_PERCENTUAL_TRIBUTOS_SN",
  );

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
      : 3,
    regimeTributarioSimplesNacional: regimeSnRaw && Number.isFinite(Number(regimeSnRaw))
      ? Number(regimeSnRaw)
      : 1,
    percentualTotalTributosSimples:
      percentualSnRaw && Number.isFinite(Number(percentualSnRaw))
        ? Number(percentualSnRaw)
        : 6,
  };
}

const MESES_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
] as const;

/** docs/texto_padrao_emissao_nf.txt — conversão de duração por multiplicidade */
export const DURACAO_POR_MULTIPLICIDADE: Record<number, string> = {
  1: "1H 25 MINUTOS",
  2: "2H 55 MINUTOS",
  3: "4H 25 MINUTOS",
  4: "5H 55 MINUTOS",
};

function competenciaDate(nf: NfForFocus): string {
  const mes = nf.competencia_mes ?? new Date().getMonth() + 1;
  const ano = nf.competencia_ano ?? new Date().getFullYear();
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

function mesNomePt(mes: number | null | undefined): string | null {
  if (!mes || mes < 1 || mes > 12) return null;
  return MESES_PT[mes - 1];
}

function formatSessoesCount(total: number): string {
  return String(total).padStart(2, "0");
}

function formatCrefito(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const letter = (raw.match(/[A-Za-z]\s*$/)?.[0] ?? "F").toUpperCase();
  if (digits.length >= 6) {
    return `CREFITO: ${digits.slice(0, -3)} ${digits.slice(-3)}-${letter}`;
  }
  const cleaned = raw.replace(/^CREFITO[:\s]*/i, "").trim().toUpperCase();
  return cleaned.startsWith("CREFITO") ? cleaned : `CREFITO: ${cleaned}`;
}

/** Formata lista de dias → "02, 06, 09 E 13" (padrão CB MOVE). */
export function formatDiasAtendidos(dias: number[]): string {
  const uniq = [...new Set(dias)]
    .filter((d) => Number.isFinite(d) && d >= 1 && d <= 31)
    .sort((a, b) => a - b)
    .map((d) => String(d).padStart(2, "0"));
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return uniq[0];
  return `${uniq.slice(0, -1).join(", ")} E ${uniq[uniq.length - 1]}`;
}

/**
 * Extrai a multiplicidade da sessão a partir de texto livre (ex.: frequencia_atendimento).
 * Casa apenas as PALAVRAS duplo/triplo/quadruplo — evita falso-positivo com "2x semana".
 */
export function tipoSessaoDeTexto(texto: string | null | undefined): string {
  const t = (texto ?? "").toLowerCase();
  if (/quadr[úu]plo/.test(t)) return "quadruplo";
  if (/triplo/.test(t)) return "triplo";
  if (/dupl[oa]/.test(t)) return "duplo";
  return "simples";
}

function multiplicidadeFromTipo(tipoSessao: string | null | undefined): number {
  const t = (tipoSessao ?? "simples").toLowerCase();
  if (t.includes("quadruplo") || t.includes("4x")) return 4;
  if (t.includes("triplo") || t.includes("3x")) return 3;
  if (t.includes("duplo") || t.includes("2x") || t.includes("dupla")) return 2;
  return 1;
}

function rotuloTipoSessao(tipoSessao: string | null | undefined): string {
  const m = multiplicidadeFromTipo(tipoSessao);
  if (m === 1) return "SIMPLES ";
  if (m === 2) return "DUPLAS ";
  return "";
}

function formatMoneyBr(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Texto padrão CB MOVE — fonte: docs/texto_padrao_emissao_nf.txt
 * (Google Doc "TEXTO PADRÃO PARA EMISSÃO DAS NOTAS FISCAIS NO PORTAL").
 */
export function buildDescricaoServico(nf: NfForFocus): string {
  const mesNome = mesNomePt(nf.competencia_mes);
  const ano = nf.competencia_ano;
  const dias = (nf.corpo_dias_atendidos ?? "").trim();
  const total = nf.corpo_total_sessoes;
  const mult = multiplicidadeFromTipo(nf.tipo_sessao);
  const duracao = (nf.duracao_sessao ?? DURACAO_POR_MULTIPLICIDADE[mult] ?? "1H 25 MINUTOS")
    .trim()
    .toUpperCase();
  const fisio = (nf.fisio_nome ?? "DRA. CHARLENE BRITO").trim().toUpperCase();
  const crefitoLabel = formatCrefito(nf.fisio_crefito ?? "122334-F");
  const excecoes = (nf.observacao_excecoes ?? "").trim();
  const valorSessao = nf.valor_sessao != null && Number(nf.valor_sessao) > 0
    ? `VALOR DA SESSÃO R$ ${formatMoneyBr(Number(nf.valor_sessao))}.`
    : null;

  const blocoTotal = total != null && total > 0
    ? `TOTALIZANDO ${formatSessoesCount(total)} SESSÕES ${rotuloTipoSessao(nf.tipo_sessao)}DE ${duracao} DE DURAÇÃO.`
    : null;

  const rodape = [
    valorSessao,
    `FISIOTERAPEUTA RESPONSÁVEL: ${fisio}.`,
    crefitoLabel.endsWith(".") ? crefitoLabel : `${crefitoLabel}.`,
  ].filter(Boolean);

  // Judicial — padrão Ana Esmeralda / João Carlos / Debora (com paciente + CPF + processo)
  if (nf.tipo === "judicial") {
    const nome = (nf.corpo_paciente_nome ?? "").trim().toUpperCase();
    const cpf = (nf.corpo_paciente_cpf ?? "").trim();
    const processo = (nf.corpo_numero_processo ?? "").trim();
    const cabeca = [
      "REFERENTE ÀS SESSÕES DE FISIOTERAPIA NEUROFUNCIONAL ESPECIALIZADA",
      nome ? `PRESTADAS A ${nome}` : null,
      cpf ? `CPF: ${cpf}` : null,
      mesNome && ano && dias
        ? `REALIZADAS NO MÊS DE ${mesNome} DE ${ano}, NOS SEGUINTES DIAS: ${dias}.`
        : mesNome && ano
        ? `REALIZADAS NO MÊS DE ${mesNome} DE ${ano}.`
        : null,
    ].filter(Boolean).join(", ");

    return [
      cabeca.endsWith(".") ? cabeca : `${cabeca}.`,
      excecoes || null,
      blocoTotal,
      processo ? `NÚMERO DO PROCESSO: ${processo}.` : null,
      ...rodape,
    ].filter(Boolean).join(" ");
  }

  // Particular / convênio — padrão Amanda / Luciana / Kayhan
  if (mesNome && ano && dias && total != null && total > 0) {
    return [
      `REFERENTE ÀS SESSÕES DE FISIOTERAPIA NEUROFUNCIONAL ESPECIALIZADA, REALIZADAS NO MÊS DE ${mesNome} DE ${ano}, NOS SEGUINTES DIAS: ${dias}.`,
      excecoes || null,
      blocoTotal,
      ...rodape,
    ].filter(Boolean).join(" ");
  }

  // Fallback mínimo (dados incompletos)
  const paciente = nf.corpo_paciente_nome ?? nf.destinatario_nome ?? "Paciente";
  const comp = nf.competencia_mes && nf.competencia_ano
    ? `${String(nf.competencia_mes).padStart(2, "0")}/${nf.competencia_ano}`
    : "";
  return [
    "REFERENTE ÀS SESSÕES DE FISIOTERAPIA NEUROFUNCIONAL ESPECIALIZADA",
    `PACIENTE: ${paciente}.`,
    total != null ? `TOTALIZANDO ${formatSessoesCount(total)} SESSÕES.` : null,
    dias ? `DIAS: ${dias}.` : null,
    comp ? `COMPETÊNCIA: ${comp}.` : null,
    ...rodape,
  ].filter(Boolean).join(" ");
}

function appendTomadorFields(
  payload: Record<string, unknown>,
  doc: string,
  nome: string | null | undefined,
  tomador: TomadorForFocus | null | undefined,
  fallbackMunicipioPoa: number,
): void {
  if (doc.length === 11) {
    payload.cpf_tomador = doc;
    if (nome) payload.razao_social_tomador = nome;
  } else if (doc.length === 14) {
    payload.cnpj_tomador = doc;
    if (nome) payload.razao_social_tomador = nome;
  } else {
    throw new Error("Destinatário sem CPF/CNPJ válido para emissão automática");
  }

  const municipio = tomador?.codigo_municipio_ibge ?? fallbackMunicipioPoa;
  payload.codigo_municipio_tomador = String(municipio);

  if (!tomador) return;

  if (tomador.email) payload.email_tomador = tomador.email;
  if (tomador.telefone) payload.telefone_tomador = onlyDigits(tomador.telefone);
  if (tomador.endereco) payload.logradouro_tomador = tomador.endereco.slice(0, 255);
  if (tomador.numero) payload.numero_tomador = tomador.numero.slice(0, 60);
  if (tomador.complemento) payload.complemento_tomador = tomador.complemento.slice(0, 156);
  if (tomador.bairro) payload.bairro_tomador = tomador.bairro.slice(0, 60);
  if (tomador.cep) payload.cep_tomador = onlyDigits(tomador.cep);
  if (tomador.uf) payload.uf_tomador = tomador.uf.toUpperCase().slice(0, 2);
}

function brasiliaNowIso(): string {
  // toISOString() é UTC; não pode concatenar "-03:00" nele (gera data no futuro → E0008).
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

export function buildFocusNfsenPayload(
  nf: NfForFocus,
  config: FocusNfeConfig,
): Record<string, unknown> {
  const dataEmissao = brasiliaNowIso();
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

  // ME/EPP (e MEI): CNC exige regime de apuração + pTotTribSN (E0166 / schema totTrib).
  if (config.codigoOpcaoSimplesNacional === 2 || config.codigoOpcaoSimplesNacional === 3) {
    payload.regime_tributario_simples_nacional =
      config.regimeTributarioSimplesNacional ?? 1;
    payload.percentual_total_tributos_simples_nacional =
      config.percentualTotalTributosSimples ?? 6;
  }

  if (config.inscricaoMunicipal) {
    payload.inscricao_municipal_prestador = config.inscricaoMunicipal;
  }

  appendTomadorFields(
    payload,
    doc,
    nf.destinatario_nome,
    nf.tomador,
    config.codigoMunicipio,
  );

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

export function focusRefFromNfId(nfId: string): string {
  return `${FOCUS_REF_PREFIX}${nfId}`;
}

export function nfIdFromFocusRef(ref: string | null | undefined): string | null {
  if (!ref || !ref.startsWith(FOCUS_REF_PREFIX)) return null;
  const id = ref.slice(FOCUS_REF_PREFIX.length);
  return id.length >= 32 ? id : null;
}

export async function verifyFocusWebhookSecret(
  admin: SupabaseClient,
  req: Request,
): Promise<boolean> {
  const expected = await getIntegracaoConfigValue(admin, "FOCUSNFE_WEBHOOK_SECRET");
  if (!expected) return true;

  const header =
    req.headers.get("X-Webhook-Secret") ??
    req.headers.get("x-webhook-secret") ??
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  return header === expected;
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
  return s === "autorizado" || s === "autorizada";
}

function isProcessing(status: string): boolean {
  const s = status.toLowerCase();
  return s === "processando_autorizacao" || s === "processando";
}

function isError(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("erro") || s.includes("deneg") || s === "cancelado";
}

function formatFocusError(data: Record<string, unknown>): string {
  const erros = data.erros;
  if (Array.isArray(erros) && erros.length > 0) {
    const first = erros[0] as Record<string, unknown>;
    return String(first.mensagem ?? first.codigo ?? "Erro na autorização NFS-e");
  }
  return String(
    data.mensagem_sefaz ?? data.mensagem ?? data.erro ?? "Erro na autorização NFS-e",
  );
}

export async function submitFocusNfsen(
  config: FocusNfeConfig,
  ref: string,
  nf: NfForFocus,
): Promise<FocusEmitResult> {
  const payload = buildFocusNfsenPayload(nf, config);
  const data = await focusRequest(
    config,
    "POST",
    `/v2/nfsen?ref=${encodeURIComponent(ref)}`,
    payload,
  );

  return {
    ref,
    status: String(data.status ?? "processando_autorizacao"),
    numero: extractNumero(data),
    pdfUrl: extractPdfUrl(data),
    raw: data,
  };
}

export async function getFocusNfsen(
  config: FocusNfeConfig,
  ref: string,
): Promise<FocusEmitResult> {
  const data = await focusRequest(config, "GET", `/v2/nfsen/${encodeURIComponent(ref)}`);
  return {
    ref,
    status: String(data.status ?? "processando_autorizacao"),
    numero: extractNumero(data),
    pdfUrl: extractPdfUrl(data),
    raw: data,
  };
}

export type ApplyFocusWebhookResult = {
  nf_id: string | null;
  focus_status: string;
  nf_status?: string;
  skipped?: string;
  email?: { ok: boolean; queued?: boolean; error?: string };
};

export async function applyFocusNfsenWebhook(
  admin: SupabaseClient,
  payload: unknown,
): Promise<ApplyFocusWebhookResult> {
  const data = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const ref = String(data.ref ?? "");
  const nfId = nfIdFromFocusRef(ref);
  if (!nfId) {
    return { nf_id: null, focus_status: String(data.status ?? "desconhecido"), skipped: "ref_invalida" };
  }

  const status = String(data.status ?? "processando_autorizacao");

  if (isProcessing(status)) {
    await admin
      .from("notas_fiscais")
      .update({ status: "processando", fiscal_provider: "focus_nfe" })
      .eq("id", nfId)
      .in("status", ["pendente", "processando", "erro"]);

    return { nf_id: nfId, focus_status: status, nf_status: "processando" };
  }

  if (isError(status)) {
    await admin
      .from("notas_fiscais")
      .update({ status: "erro", fiscal_provider: "focus_nfe" })
      .eq("id", nfId);

    return { nf_id: nfId, focus_status: status, nf_status: "erro" };
  }

  if (!isAuthorized(status)) {
    return { nf_id: nfId, focus_status: status, skipped: "status_ignorado" };
  }

  const { data: nf } = await admin
    .from("notas_fiscais")
    .select("id, tipo, competencia_ano, status")
    .eq("id", nfId)
    .maybeSingle();

  if (!nf) {
    return { nf_id: nfId, focus_status: status, skipped: "nf_nao_encontrada" };
  }

  if (nf.status === "emitida") {
    return { nf_id: nfId, focus_status: status, nf_status: "emitida", skipped: "ja_emitida" };
  }

  const ano = nf.competencia_ano ?? new Date().getFullYear();
  const numeroNf = extractNumero(data) ?? `REF-${ref.slice(0, 12)}`;
  let pdfStorageUrl: string | null = extractPdfUrl(data);

  if (pdfStorageUrl) {
    try {
      pdfStorageUrl = await uploadPdfFromUrl(admin, pdfStorageUrl, `nf/${ano}/${numeroNf}.pdf`);
    } catch {
      // mantém URL Focus se upload falhar
    }
  }

  const emissao = new Date().toISOString().split("T")[0];
  const { error: updErr } = await admin
    .from("notas_fiscais")
    .update({
      numero: numeroNf,
      pdf_url: pdfStorageUrl,
      status: "emitida",
      emissao,
      emitida_em: new Date().toISOString(),
      fiscal_provider: "focus_nfe",
    })
    .eq("id", nfId);

  if (updErr) throw updErr;

  const email = await queueNfEmail(admin, nfId, {
    tipo: nf.tipo,
    eventId: `nf-emit-${nfId}`,
  });

  return {
    nf_id: nfId,
    focus_status: status,
    nf_status: "emitida",
    email,
  };
}

/** Polling opcional (scripts/legado). Produção usa webhook. */
export async function emitFocusNfsen(
  config: FocusNfeConfig,
  ref: string,
  nf: NfForFocus,
): Promise<FocusEmitResult> {
  await submitFocusNfsen(config, ref, nf);

  const maxAttempts = 45;
  const delayMs = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const result = await getFocusNfsen(config, ref);

    if (isAuthorized(result.status)) return result;

    if (isError(result.status)) {
      throw new Error(`Focus NFe rejeitou: ${formatFocusError(result.raw)}`);
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
