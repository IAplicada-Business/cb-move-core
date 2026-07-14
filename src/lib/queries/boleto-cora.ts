import {
  formatCoraApiErrorBody,
  validarCobrancaParaBoletoCora,
} from "@/lib/domain/cora-boleto";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { supabase } from "@/integrations/supabase/client";

export type EmitBoletoCoraResult = {
  ok: boolean;
  cobrancaId: string;
  boletoUrl: string | null;
  coraInvoiceId: string | null;
  pixEmv: string | null;
};

export type SendBoletoCobrancaResult = {
  ok: boolean;
  queued: boolean;
  duplicate?: boolean;
  eventId: string;
};

export class CoraNaoConfiguradaError extends Error {
  constructor(
    message = "Integração Cora não configurada. Configure CORA_CLIENT_ID + certificado/chave em Integrações (ou aguarde a IAplicada aplicar as credenciais).",
  ) {
    super(message);
    this.name = "CoraNaoConfiguradaError";
  }
}

export class BoletoEnvioNaoConfiguradoError extends Error {
  constructor(
    message = "Automação de envio não configurada. Configure N8N_WEBHOOK_BOLETO_DOCS em Integrações quando o workflow n8n estiver pronto.",
  ) {
    super(message);
    this.name = "BoletoEnvioNaoConfiguradoError";
  }
}

function formatCoraError(msg: string): string {
  if (/token \(mtls\) falhou \(401\)|not authorized|access_denied/i.test(msg)) {
    return (
      "Cora recusou autenticação (401). Verifique credenciais STAGE (cert+key+Client ID) " +
      "e se a etapa de autorização da Integração Direta foi concluída no Cora Web."
    );
  }
  const statusMatch = msg.match(/Cora (?:invoice falhou|recusou)[^(]*\((\d+)\)/i);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;
  const friendly = formatCoraApiErrorBody(msg, status);
  if (friendly !== msg.trim()) return friendly;
  if (/customer\.document|cpf\/cnpj/i.test(msg)) {
    return "Cadastre o CPF/CNPJ do paciente em Pacientes antes de emitir o boleto.";
  }
  if (/customer\.email|e-mail do paciente/i.test(msg)) {
    return "Cadastre o e-mail do paciente em Pacientes antes de emitir o boleto.";
  }
  if (/payment_terms|duedate|past date|vencimento/i.test(msg)) {
    return "Atualize a data de vencimento da cobrança para hoje ou uma data futura.";
  }
  return msg;
}

function isCoraNaoConfigurada(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("não configurada") ||
    m.includes("nao configurada") ||
    m.includes("cora_client_id") ||
    m.includes("modo manual")
  );
}

function isBoletoEnvioNaoConfigurado(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("n8n_webhook_boleto_docs") || m.includes("automação de envio não configurada");
}

export type ValidarBoletoCoraCobranca = {
  pacienteCpf?: string | null;
  pacienteEmail?: string | null;
  vencimento?: string | null;
  valor: number;
};

export function validarEmitBoletoCoraLocal(c: ValidarBoletoCoraCobranca): string | null {
  return validarCobrancaParaBoletoCora({
    cpf: c.pacienteCpf,
    email: c.pacienteEmail,
    vencimento: c.vencimento,
    valor: c.valor,
  });
}

/**
 * Gera boleto/PIX via edge emit-boleto-cora (API Cora).
 * Sem credenciais a edge responde 501 — propaga CoraNaoConfiguradaError.
 */
export async function gerarBoletoCora(cobrancaId: string): Promise<EmitBoletoCoraResult> {
  const { data: row, error: loadErr } = await supabase
    .from("cobrancas")
    .select("valor, vencimento, pacientes(cpf, email)")
    .eq("id", cobrancaId)
    .single();
  if (loadErr) throw loadErr;

  const pac = row.pacientes as { cpf: string | null; email: string | null } | null;
  const localErr = validarEmitBoletoCoraLocal({
    pacienteCpf: pac?.cpf,
    pacienteEmail: pac?.email,
    vencimento: row.vencimento,
    valor: Number(row.valor) || 0,
  });
  if (localErr) throw new Error(localErr);

  try {
    const data = await invokeEdgeFunction<{
      ok?: boolean;
      cobranca_id?: string;
      boleto_url?: string | null;
      cora_invoice_id?: string | null;
      pix_emv?: string | null;
    }>("emit-boleto-cora", { cobranca_id: cobrancaId });

    return {
      ok: Boolean(data?.ok),
      cobrancaId: data?.cobranca_id ?? cobrancaId,
      boletoUrl: data?.boleto_url ?? null,
      coraInvoiceId: data?.cora_invoice_id ?? null,
      pixEmv: data?.pix_emv ?? null,
    };
  } catch (e) {
    const msg = formatCoraError(e instanceof Error ? e.message : "Falha ao emitir boleto Cora");
    if (isCoraNaoConfigurada(msg)) throw new CoraNaoConfiguradaError(msg);
    throw new Error(msg);
  }
}

/** @deprecated Use gerarBoletoCora */
export const emitBoletoCora = gerarBoletoCora;

/**
 * Enfileira envio do boleto ao paciente (e-mail + WhatsApp) via n8n.
 * Exige boleto já gerado. Sem webhook configurado → BoletoEnvioNaoConfiguradoError.
 */
export async function enviarBoletoCobranca(
  cobrancaId: string,
  options?: { reenvio?: boolean },
): Promise<SendBoletoCobrancaResult> {
  try {
    const data = await invokeEdgeFunction<{
      ok?: boolean;
      queued?: boolean;
      duplicate?: boolean;
      event_id?: string;
    }>("send-boleto-cobranca", {
      cobranca_id: cobrancaId,
      event_id: `boleto-docs-${cobrancaId}`,
      reenvio: Boolean(options?.reenvio),
    });

    return {
      ok: Boolean(data?.ok),
      queued: Boolean(data?.queued),
      duplicate: data?.duplicate,
      eventId: data?.event_id ?? `boleto-docs-${cobrancaId}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar boleto";
    if (isBoletoEnvioNaoConfigurado(msg)) throw new BoletoEnvioNaoConfiguradoError(msg);
    throw e instanceof Error ? e : new Error(msg);
  }
}
