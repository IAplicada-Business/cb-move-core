import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCoraAccessToken, getCoraInvoice, resolveCoraConfig, type CoraConfig } from "./cora.ts";
import { getIntegracaoConfigValue } from "./integracao-config.ts";
import { INTERNAL_TRIGGER_HEADER } from "./auth.ts";

/**
 * Núcleo compartilhado da automação "boleto Cora pago -> NF disparada automaticamente".
 * Chamado tanto pelo polling (`cora-verificar-pagamentos`, a cada 15-30 min) quanto pelo
 * webhook (`cora-webhook`, como "campainha" de baixa latência). O webhook nunca é fonte de
 * verdade: em ambos os casos o status real é sempre reconfirmado aqui via
 * `GET /v2/invoices/{id}` (mTLS) antes de qualquer ação — ver docs/notas_spike_cora_stage.md.
 *
 * Fluxo por cobrança: consulta invoice -> (se PAID) RPC marcar_cobranca_paga_cora ->
 * criar_nf_de_cobranca (no-op se já existir NF) -> chamada interna a emit-nf -> log de evento
 * em `cobrancas_pagamentos_eventos`.
 */

export type SyncOrigin = "polling" | "webhook";

export type CobrancaPendenteCora = {
  id: string;
  cora_invoice_id: string;
};

export type SyncResult = {
  cobranca_id: string;
  cora_invoice_id: string;
  cora_status: string | null;
  marcou_pago: boolean;
  nf_criada: boolean;
  nf_id: string | null;
  emit_nf_disparado: boolean;
  erro: string | null;
};

async function isAutoNfEnabled(admin: SupabaseClient): Promise<boolean> {
  const value = await getIntegracaoConfigValue(admin, "CORA_AUTO_NF_ENABLED");
  // Kill switch: só desliga com valor explícito "false". Ausente/qualquer outro valor = habilitado.
  return value !== "false";
}

function sanitizeInvoiceForLog(invoice: Record<string, unknown>): Record<string, unknown> {
  return {
    id: invoice.id ?? null,
    status: invoice.status ?? null,
    payments: invoice.payments ?? null,
  };
}

async function logEvento(
  admin: SupabaseClient,
  origin: SyncOrigin,
  result: SyncResult,
  extra: { payload?: Record<string, unknown> | null } = {},
): Promise<void> {
  // Nota: webhook_event_id não é gravado aqui de propósito. O dedup de entregas de
  // webhook é uma marca única separada (1 linha por evento, cobranca_id NULL), feita pelo
  // próprio `cora-webhook` antes de disparar a varredura — ver esse arquivo. Se anexássemos
  // o mesmo webhook_event_id a cada linha de cobrança sincronizada aqui, o índice único
  // parcial em webhook_event_id quebraria sempre que mais de uma cobrança fosse paga na
  // mesma varredura.
  const { error } = await admin.from("cobrancas_pagamentos_eventos").insert({
    cobranca_id: result.cobranca_id,
    origem: origin,
    cora_invoice_id: result.cora_invoice_id,
    status_cora_novo: result.cora_status,
    marcou_pago: result.marcou_pago,
    nf_criada: result.nf_criada,
    nf_id: result.nf_id,
    emit_nf_disparado: result.emit_nf_disparado,
    erro: result.erro,
    payload: extra.payload ?? null,
  });
  if (error) {
    console.error("[cora-payment-sync] falha ao gravar cobrancas_pagamentos_eventos", error);
  }
}

async function triggerEmitNf(
  supabaseUrl: string,
  serviceKey: string,
  nfId: string,
): Promise<{ ok: boolean; erro: string | null }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/emit-nf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        [INTERNAL_TRIGGER_HEADER]: "cora-payment-sync",
      },
      body: JSON.stringify({ nf_id: nfId }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      const detail = typeof body?.error === "string" ? body.error : JSON.stringify(body).slice(0, 300);
      return { ok: false, erro: `emit-nf retornou ${res.status}: ${detail}` };
    }
    return { ok: true, erro: null };
  } catch (err) {
    return { ok: false, erro: `emit-nf: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Sincroniza uma cobrança específica contra o status real na Cora. Idempotente: se o
 * boleto ainda não estiver `PAID`, não faz nada e não grava evento (evita ruído a cada
 * ciclo de polling). Se já foi marcada `pago` por outra chamada concorrente, encerra sem
 * duplicar a criação de NF.
 */
export async function syncCobrancaPagamentoCora(
  admin: SupabaseClient,
  coraConfig: CoraConfig,
  token: string,
  cobranca: CobrancaPendenteCora,
  origin: SyncOrigin,
  ctx: { supabaseUrl: string; serviceKey: string; autoNfEnabled: boolean },
): Promise<SyncResult> {
  const result: SyncResult = {
    cobranca_id: cobranca.id,
    cora_invoice_id: cobranca.cora_invoice_id,
    cora_status: null,
    marcou_pago: false,
    nf_criada: false,
    nf_id: null,
    emit_nf_disparado: false,
    erro: null,
  };

  let invoice: Record<string, unknown> | null = null;

  try {
    const invoiceRes = await getCoraInvoice(coraConfig, token, cobranca.cora_invoice_id);
    if (!invoiceRes.ok) {
      const detail = await invoiceRes.text();
      throw new Error(
        `GET /v2/invoices/${cobranca.cora_invoice_id} falhou (${invoiceRes.status}): ${detail.slice(0, 300)}`,
      );
    }
    invoice = (await invoiceRes.json()) as Record<string, unknown>;
    result.cora_status = typeof invoice.status === "string" ? invoice.status : null;
  } catch (err) {
    result.erro = err instanceof Error ? err.message : String(err);
    await logEvento(admin, origin, result);
    return result;
  }

  if (result.cora_status !== "PAID") {
    // Nada mudou — não é um evento relevante, não grava log (evita ruído no polling).
    return result;
  }

  try {
    const pagoEm = new Date().toISOString().slice(0, 10);
    const { data: updated, error: rpcErr } = await admin.rpc("marcar_cobranca_paga_cora", {
      p_cobranca_id: cobranca.id,
      p_pago_em: pagoEm,
      p_payload: invoice,
    });
    if (rpcErr) throw rpcErr;
    result.marcou_pago = Array.isArray(updated) && updated.length > 0;
  } catch (err) {
    result.erro = `marcar_cobranca_paga_cora: ${err instanceof Error ? err.message : String(err)}`;
    await logEvento(admin, origin, result, { payload: sanitizeInvoiceForLog(invoice) });
    return result;
  }

  if (!result.marcou_pago) {
    // Já estava paga (corrida polling/webhook ou marcação manual prévia) — idempotente.
    await logEvento(admin, origin, result, { payload: sanitizeInvoiceForLog(invoice) });
    return result;
  }

  if (!ctx.autoNfEnabled) {
    result.erro = "CORA_AUTO_NF_ENABLED=false — pagamento confirmado, NF não disparada (kill switch)";
    await logEvento(admin, origin, result, { payload: sanitizeInvoiceForLog(invoice) });
    return result;
  }

  let nfId: string | null = null;
  try {
    const { data, error: nfErr } = await admin.rpc("criar_nf_de_cobranca", { p_cobranca_id: cobranca.id });
    if (nfErr) {
      if (!(nfErr.message ?? "").toLowerCase().includes("já existe nf")) {
        throw nfErr;
      }
      // No-op: já existia NF para esta cobrança — não reemitir.
    } else {
      nfId = typeof data === "string" ? data : null;
      result.nf_criada = Boolean(nfId);
    }
  } catch (err) {
    result.erro = `criar_nf_de_cobranca: ${err instanceof Error ? err.message : String(err)}`;
    await logEvento(admin, origin, result, { payload: sanitizeInvoiceForLog(invoice) });
    return result;
  }

  if (nfId) {
    result.nf_id = nfId;
    const emitResult = await triggerEmitNf(ctx.supabaseUrl, ctx.serviceKey, nfId);
    result.emit_nf_disparado = emitResult.ok;
    if (!emitResult.ok) result.erro = emitResult.erro;
  }

  await logEvento(admin, origin, result, { payload: sanitizeInvoiceForLog(invoice) });
  return result;
}

type SyncContext = { supabaseUrl: string; serviceKey: string; autoNfEnabled: boolean };

async function buildSyncContext(admin: SupabaseClient): Promise<{ coraConfig: CoraConfig; token: string; ctx: SyncContext }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
  }

  const coraConfig = await resolveCoraConfig(admin);
  if (!coraConfig) {
    throw new Error("Integração Cora não configurada (CORA_CLIENT_ID/CERTIFICATE/PRIVATE_KEY)");
  }

  const token = await getCoraAccessToken(coraConfig);
  const autoNfEnabled = await isAutoNfEnabled(admin);
  return { coraConfig, token, ctx: { supabaseUrl, serviceKey, autoNfEnabled } };
}

/**
 * Varre todas as cobrancas com boleto automático (`boleto_modo = 'automatico'`) ainda em
 * aberto/atrasado e sincroniza cada uma contra a Cora. Usado pelo cron
 * (`cora-verificar-pagamentos`) e, como fallback, pelo webhook (`cora-webhook`) quando o
 * evento não trouxer o header `webhook-resource-id`.
 */
export async function syncPagamentosCoraPendentes(
  admin: SupabaseClient,
  origin: SyncOrigin,
): Promise<{ verificadas: number; pagas: number; resultados: SyncResult[] }> {
  const { data: pendentes, error: queryErr } = await admin
    .from("cobrancas")
    .select("id, cora_invoice_id")
    .in("status", ["pendente", "atrasado"])
    .eq("boleto_modo", "automatico")
    .not("cora_invoice_id", "is", null);
  if (queryErr) throw queryErr;

  const cobrancas = (pendentes ?? []) as CobrancaPendenteCora[];
  if (cobrancas.length === 0) {
    return { verificadas: 0, pagas: 0, resultados: [] };
  }

  const { coraConfig, token, ctx } = await buildSyncContext(admin);

  const resultados: SyncResult[] = [];
  for (const cobranca of cobrancas) {
    const result = await syncCobrancaPagamentoCora(admin, coraConfig, token, cobranca, origin, ctx);
    resultados.push(result);
  }

  return {
    verificadas: cobrancas.length,
    pagas: resultados.filter((r) => r.marcou_pago).length,
    resultados,
  };
}

/**
 * Sincroniza uma única cobrança a partir do `cora_invoice_id` — usado pelo webhook quando
 * o evento traz o header `webhook-resource-id` (o corpo da notificação vem vazio, mas esse
 * header identifica o boleto). Evita varrer todas as cobranças pendentes a cada ping.
 * Retorna `null` se nenhuma cobrança automática corresponder (ex.: evento de teste da Cora).
 */
export async function syncCobrancaPorInvoiceId(
  admin: SupabaseClient,
  coraInvoiceId: string,
  origin: SyncOrigin,
): Promise<SyncResult | null> {
  const { data: cobranca, error: queryErr } = await admin
    .from("cobrancas")
    .select("id, cora_invoice_id")
    .eq("cora_invoice_id", coraInvoiceId)
    .eq("boleto_modo", "automatico")
    .maybeSingle();
  if (queryErr) throw queryErr;
  if (!cobranca) return null;

  const { coraConfig, token, ctx } = await buildSyncContext(admin);
  return syncCobrancaPagamentoCora(admin, coraConfig, token, cobranca as CobrancaPendenteCora, origin, ctx);
}
