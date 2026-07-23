import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCoraAccessToken, getCoraInvoice, resolveCoraConfig, type CoraConfig } from "./cora.ts";
import { getIntegracaoConfigValue } from "./integracao-config.ts";
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

type SyncContext = { supabaseUrl: string; serviceKey: string; autoNfEnabled: boolean };

type ModoEmissaoNf = "automatico_pagamento" | "data_especifica";

async function isAutoNfEnabled(admin: SupabaseClient): Promise<boolean> {
  const value = await getIntegracaoConfigValue(admin, "CORA_AUTO_NF_ENABLED");
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

async function fetchModoEmissaoNf(
  admin: SupabaseClient,
  cobrancaId: string,
): Promise<ModoEmissaoNf> {
  const { data, error } = await admin
    .from("cobrancas")
    .select("pacientes(modo_emissao_nf)")
    .eq("id", cobrancaId)
    .maybeSingle();
  if (error) throw error;
  const pacientes = data as { pacientes?: { modo_emissao_nf?: string | null } | null } | null;
  const modo = pacientes?.pacientes?.modo_emissao_nf;
  return modo === "data_especifica" ? "data_especifica" : "automatico_pagamento";
}

async function findNfEmitivel(admin: SupabaseClient, cobrancaId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("notas_fiscais")
    .select("id")
    .eq("cobranca_id", cobrancaId)
    .in("status", ["pendente", "erro"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function criarOuObterNfEmitivel(
  admin: SupabaseClient,
  cobrancaId: string,
): Promise<{ nfId: string | null; criada: boolean; erro: string | null }> {
  const { data, error: nfErr } = await admin.rpc("criar_nf_de_cobranca", { p_cobranca_id: cobrancaId });
  if (!nfErr) {
    const nfId = typeof data === "string" ? data : null;
    return { nfId, criada: Boolean(nfId), erro: null };
  }

  if ((nfErr.message ?? "").toLowerCase().includes("já existe nf")) {
    const nfId = await findNfEmitivel(admin, cobrancaId);
    return { nfId, criada: false, erro: nfId ? null : "NF existente já emitida ou em processamento" };
  }

  return { nfId: null, criada: false, erro: nfErr.message ?? String(nfErr) };
}

async function processAutoNfAfterPaid(
  admin: SupabaseClient,
  cobrancaId: string,
  ctx: SyncContext,
  result: SyncResult,
): Promise<void> {
  if (!ctx.autoNfEnabled) {
    result.erro = "CORA_AUTO_NF_ENABLED=false — pagamento confirmado, NF não disparada (kill switch)";
    return;
  }

  let modo: ModoEmissaoNf;
  try {
    modo = await fetchModoEmissaoNf(admin, cobrancaId);
  } catch (err) {
    result.erro = `modo_emissao_nf: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }

  if (modo === "data_especifica") {
    result.erro = "Paciente em modo data_especifica — NF será emitida no cron, não no pagamento";
    return;
  }

  const { nfId, criada, erro } = await criarOuObterNfEmitivel(admin, cobrancaId);
  if (erro && !nfId) {
    result.erro = erro.startsWith("criar_nf") ? erro : `criar_nf_de_cobranca: ${erro}`;
    return;
  }

  result.nf_criada = criada;
  if (!nfId) return;

  result.nf_id = nfId;
  const emitResult = await triggerEmitNf(ctx.supabaseUrl, ctx.serviceKey, nfId, "cora-payment-sync");
  result.emit_nf_disparado = emitResult.ok;
  if (!emitResult.ok) result.erro = emitResult.erro;
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

  await processAutoNfAfterPaid(admin, cobranca.id, ctx, result);
  await logEvento(admin, origin, result, { payload: sanitizeInvoiceForLog(invoice) });
  return result;
}

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
    const pacientes = row.pacientes as { modo_emissao_nf?: string | null } | null;
    if (pacientes?.modo_emissao_nf === "data_especifica") continue;

    const nfId = await findNfEmitivel(admin, row.id as string);
    if (!nfId) continue;

    const result: SyncResult = {
      cobranca_id: row.id as string,
      cora_invoice_id: (row.cora_invoice_id as string) ?? "",
      cora_status: "PAID",
      marcou_pago: false,
      nf_criada: false,
      nf_id: nfId,
      emit_nf_disparado: false,
      erro: "retry cobrança já paga",
    };

    const emitResult = await triggerEmitNf(ctx.supabaseUrl, ctx.serviceKey, nfId, "cora-payment-sync-retry");
    result.emit_nf_disparado = emitResult.ok;
    result.erro = emitResult.ok ? null : emitResult.erro;

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
