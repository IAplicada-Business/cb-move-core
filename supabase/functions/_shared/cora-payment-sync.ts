import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCoraAccessToken, getCoraInvoice, resolveCoraConfig, type CoraConfig } from "./cora.ts";
import {
  buildAutoNfContext,
  findNfEmitivel,
  processAutoNfAfterPaid,
} from "./auto-nf-after-paid.ts";
import { triggerEmitNf } from "./trigger-emit-nf.ts";

/**
 * Núcleo compartilhado da automação "boleto Cora pago -> NF disparada automaticamente".
 * Chamado tanto pelo polling (`cora-verificar-pagamentos`, a cada 15-30 min) quanto pelo
 * webhook (`cora-webhook`, como "campainha" de baixa latência). O webhook nunca é fonte de
 * verdade: em ambos os casos o status real é sempre reconfirmado aqui via
 * `GET /v2/invoices/{id}` (mTLS) antes de qualquer ação — ver docs/notas_spike_cora_stage.md.
 *
 * Fluxo por cobrança: consulta invoice -> (se PAID) RPC marcar_cobranca_paga_cora ->
 * criar_nf_de_cobranca (ou reutilizar NF pendente/erro) -> chamada interna a emit-nf ->
 * log de evento em `cobrancas_pagamentos_eventos`.
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

type SyncContext = Awaited<ReturnType<typeof buildAutoNfContext>>;

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

/**
 * Sincroniza uma cobrança específica contra o status real na Cora. Idempotente: se o
 * boleto ainda não estiver `PAID`, não faz nada e não grava evento (evita ruído a cada
 * ciclo de polling). Se já estava paga, ainda tenta emitir NF pendente/erro quando aplicável.
 */
export async function syncCobrancaPagamentoCora(
  admin: SupabaseClient,
  coraConfig: CoraConfig,
  token: string,
  cobranca: CobrancaPendenteCora,
  origin: SyncOrigin,
  ctx: SyncContext,
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

  const autoNf = await processAutoNfAfterPaid(admin, cobranca.id, ctx);
  result.nf_criada = autoNf.nf_criada;
  result.nf_id = autoNf.nf_id;
  result.emit_nf_disparado = autoNf.emit_nf_disparado;
  result.erro = autoNf.erro;

  await logEvento(admin, origin, result, { payload: sanitizeInvoiceForLog(invoice) });
  return result;
}

async function buildSyncContext(admin: SupabaseClient): Promise<{ coraConfig: CoraConfig; token: string; ctx: SyncContext }> {
  const coraConfig = await resolveCoraConfig(admin);
  if (!coraConfig) {
    throw new Error("Integração Cora não configurada (CORA_CLIENT_ID/CERTIFICATE/PRIVATE_KEY)");
  }

  const token = await getCoraAccessToken(coraConfig);
  const ctx = await buildAutoNfContext(admin);
  return { coraConfig, token, ctx };
}

/**
 * Reemite NF para cobranças já marcadas como pagas mas com NF pendente/erro
 * (ex.: kill switch ligado no 1º sync, falha transiente em emit-nf).
 */
export async function retryAutoNfCobrancasPagas(
  admin: SupabaseClient,
  origin: SyncOrigin,
): Promise<{ verificadas: number; emitidas: number; resultados: SyncResult[] }> {
  const { ctx } = await buildSyncContext(admin);
  if (!ctx.autoNfEnabled) {
    return { verificadas: 0, emitidas: 0, resultados: [] };
  }

  const { data: cobrancas, error: queryErr } = await admin
    .from("cobrancas")
    .select("id, cora_invoice_id, pacientes(modo_emissao_nf)")
    .eq("status", "pago")
    .eq("boleto_modo", "automatico");
  if (queryErr) throw queryErr;

  const resultados: SyncResult[] = [];

  for (const row of cobrancas ?? []) {
    const cobrancaId = row.id as string;
    const pacientes = row.pacientes as { modo_emissao_nf?: string | null } | null;
    if (pacientes?.modo_emissao_nf === "data_especifica") continue;

    const nfId = await findNfEmitivel(admin, cobrancaId);
    if (nfId) {
      const result: SyncResult = {
        cobranca_id: cobrancaId,
        cora_invoice_id: (row.cora_invoice_id as string) ?? "",
        cora_status: "PAID",
        marcou_pago: false,
        nf_criada: false,
        nf_id: nfId,
        emit_nf_disparado: false,
        erro: "retry cobrança já paga",
      };

      const emitResult = await triggerEmitNf(ctx.supabaseUrl, nfId, {
        mode: "internal",
        serviceKey: ctx.serviceKey,
        origin: "cora-payment-sync-retry",
      });
      result.emit_nf_disparado = emitResult.ok;
      result.erro = emitResult.ok ? null : emitResult.erro;

      await logEvento(admin, origin, result);
      resultados.push(result);
      continue;
    }

    const { count, error: nfCountErr } = await admin
      .from("notas_fiscais")
      .select("id", { count: "exact", head: true })
      .eq("cobranca_id", cobrancaId)
      .neq("status", "cancelada");
    if (nfCountErr) throw nfCountErr;
    if ((count ?? 0) > 0) continue;

    const autoNf = await processAutoNfAfterPaid(admin, cobrancaId, ctx);
    const result: SyncResult = {
      cobranca_id: cobrancaId,
      cora_invoice_id: (row.cora_invoice_id as string) ?? "",
      cora_status: "PAID",
      marcou_pago: false,
      nf_criada: autoNf.nf_criada,
      nf_id: autoNf.nf_id,
      emit_nf_disparado: autoNf.emit_nf_disparado,
      erro: autoNf.erro,
    };
    await logEvento(admin, origin, result);
    resultados.push(result);
  }

  return {
    verificadas: resultados.length,
    emitidas: resultados.filter((r) => r.emit_nf_disparado).length,
    resultados,
  };
}

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
  const { coraConfig, token, ctx } = await buildSyncContext(admin);

  const resultados: SyncResult[] = [];
  for (const cobranca of cobrancas) {
    const result = await syncCobrancaPagamentoCora(admin, coraConfig, token, cobranca, origin, ctx);
    resultados.push(result);
  }

  const retry = await retryAutoNfCobrancasPagas(admin, origin);
  resultados.push(...retry.resultados);

  return {
    verificadas: cobrancas.length + retry.verificadas,
    pagas: resultados.filter((r) => r.marcou_pago).length,
    resultados,
  };
}

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
