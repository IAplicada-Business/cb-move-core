import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getIntegracaoConfigValue } from "./integracao-config.ts";

/** Integração Direta — stage (mTLS em todas as requisições). */
export const STAGE_MTLS_BASE = "https://matls-clients.api.stage.cora.com.br";
/** Integração Direta — produção (mTLS em todas as requisições). */
export const PROD_MTLS_BASE = "https://matls-clients.api.cora.com.br";
/** Parceria Cora — stage (OAuth sem mTLS). */
export const STAGE_OAUTH_BASE = "https://api.stage.cora.com.br";

/** POST client_credentials — docs: client-credentials-int-direta */
export const CORA_DIRECT_TOKEN_PATH = "/token";
/** POST boleto registrado — docs: utilização das APIs (Integração Direta) */
export const CORA_INVOICES_PATH = "/v2/invoices";

type CoraTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type CoraDirectConfig = {
  mode: "direct";
  clientId: string;
  certificate: string;
  privateKey: string;
  apiBase: string;
};

export type CoraPartnerConfig = {
  mode: "partner";
  clientId: string;
  clientSecret: string;
  apiBase: string;
};

export type CoraConfig = CoraDirectConfig | CoraPartnerConfig;

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function createMtlsClient(certificate: string, privateKey: string): Deno.HttpClient {
  return Deno.createHttpClient({
    cert: normalizePem(certificate),
    key: normalizePem(privateKey),
  });
}

/**
 * Token Parceria Cora — Basic auth + client_secret.
 * Integração Direta não usa este fluxo.
 */
async function getPartnerToken(
  apiBase: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${apiBase}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Cora OAuth falhou (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as CoraTokenResponse;
  return data.access_token;
}

/**
 * Token Integração Direta — mTLS + application/x-www-form-urlencoded.
 * Body: grant_type=client_credentials&client_id={clientId}
 * @see https://developers.cora.com.br/docs/client-credentials-int-direta
 */
async function getDirectToken(config: CoraDirectConfig): Promise<string> {
  const client = createMtlsClient(config.certificate, config.privateKey);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
  });

  const res = await fetch(`${config.apiBase}${CORA_DIRECT_TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    client,
  });

  if (!res.ok) {
    const detail = await res.text();
    const hint =
      res.status === 401
        ? " Integração Direta exige credenciais do mesmo ambiente (stage), mTLS (cert+key) e etapa de autorização concluída no Cora."
        : "";
    throw new Error(`Cora token (mTLS) falhou (${res.status}): ${detail}${hint}`);
  }

  const data = (await res.json()) as CoraTokenResponse;
  return data.access_token;
}

export async function getCoraAccessToken(config: CoraConfig): Promise<string> {
  if (config.mode === "direct") return getDirectToken(config);
  return getPartnerToken(config.apiBase, config.clientId, config.clientSecret);
}

/**
 * Emite boleto — Integração Direta inclui cert+key em todas as requisições.
 * Headers: Authorization Bearer, Content-Type json, Idempotency-Key (uuid).
 * @see https://developers.cora.com.br/docs/utiliza%C3%A7%C3%A3o-das-apis
 */
export async function createCoraInvoice(
  config: CoraConfig,
  token: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<Response> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };

  const url = `${config.apiBase}${CORA_INVOICES_PATH}`;

  if (config.mode === "direct") {
    const client = createMtlsClient(config.certificate, config.privateKey);
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      client,
    });
  }

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

/**
 * Consulta boleto — GET /v2/invoices/{id}. Usado para reconfirmar o status real
 * (nunca confiar apenas no corpo do webhook — ver docs/notas_spike_cora_stage.md).
 * @see https://developers.cora.com.br/reference/consultar-boletos-v2
 */
export async function getCoraInvoice(
  config: CoraConfig,
  token: string,
  invoiceId: string,
): Promise<Response> {
  const url = `${config.apiBase}${CORA_INVOICES_PATH}/${invoiceId}`;
  const headers = { Authorization: `Bearer ${token}` };

  if (config.mode === "direct") {
    const client = createMtlsClient(config.certificate, config.privateKey);
    return fetch(url, { headers, client });
  }

  return fetch(url, { headers });
}

/**
 * Paga um boleto em ambiente de Stage — endpoint exclusivo para testes
 * (não existe em produção). Usado nos scripts de spike/QA, não no fluxo de produção.
 * @see https://developers.cora.com.br/reference/pagar-boleto-em-stage
 */
export async function payCoraInvoiceStage(
  config: CoraConfig,
  token: string,
  invoiceId: string,
  idempotencyKey: string,
): Promise<Response> {
  const url = `${config.apiBase}${CORA_INVOICES_PATH}/pay`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  const body = JSON.stringify({ id: invoiceId });

  if (config.mode === "direct") {
    const client = createMtlsClient(config.certificate, config.privateKey);
    return fetch(url, { method: "POST", headers, body, client });
  }

  return fetch(url, { method: "POST", headers, body });
}

/** Integração Direta (mTLS) ou Parceria Cora (client_id + secret). */
export async function resolveCoraConfig(admin: SupabaseClient): Promise<CoraConfig | null> {
  const clientId = await getIntegracaoConfigValue(admin, "CORA_CLIENT_ID");
  if (!clientId) return null;

  const certificate = await getIntegracaoConfigValue(admin, "CORA_CERTIFICATE");
  const privateKey = await getIntegracaoConfigValue(admin, "CORA_PRIVATE_KEY");
  const apiBaseOverride = await getIntegracaoConfigValue(admin, "CORA_API_BASE");

  if (certificate && privateKey) {
    return {
      mode: "direct",
      clientId,
      certificate,
      privateKey,
      apiBase: apiBaseOverride ?? STAGE_MTLS_BASE,
    };
  }

  const clientSecret = await getIntegracaoConfigValue(admin, "CORA_CLIENT_SECRET");
  if (!clientSecret) return null;

  return {
    mode: "partner",
    clientId,
    clientSecret,
    apiBase: apiBaseOverride ?? STAGE_OAUTH_BASE,
  };
}

export function coraConfigHint(): string {
  return "Configure CORA_CLIENT_ID + CORA_CERTIFICATE + CORA_PRIVATE_KEY (Integração Direta) ou CORA_CLIENT_SECRET (Parceria).";
}
