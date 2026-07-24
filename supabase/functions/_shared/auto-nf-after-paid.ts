import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoConfigValue } from "./integracao-config.ts";
import { triggerEmitNf } from "./trigger-emit-nf.ts";

export type AutoNfResult = {
  nf_criada: boolean;
  nf_id: string | null;
  emit_nf_disparado: boolean;
  erro: string | null;
};

type AutoNfContext = {
  supabaseUrl: string;
  serviceKey: string;
  autoNfEnabled: boolean;
  emitAuthHeader?: string | null;
};

type ModoEmissaoNf = "automatico_pagamento" | "data_especifica";

async function isAutoNfEnabled(admin: SupabaseClient): Promise<boolean> {
  const value = await getIntegracaoConfigValue(admin, "CORA_AUTO_NF_ENABLED");
  return value !== "false";
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

export async function buildAutoNfContext(admin: SupabaseClient): Promise<AutoNfContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
  }
  const autoNfEnabled = await isAutoNfEnabled(admin);
  return { supabaseUrl, serviceKey, autoNfEnabled };
}

/**
 * Cria (ou reutiliza) NF pendente/erro e dispara emit-nf após cobrança paga.
 * Respeita CORA_AUTO_NF_ENABLED e pacientes.modo_emissao_nf = data_especifica.
 */
export async function processAutoNfAfterPaid(
  admin: SupabaseClient,
  cobrancaId: string,
  ctx?: AutoNfContext,
): Promise<AutoNfResult> {
  const resolvedCtx = ctx ?? await buildAutoNfContext(admin);
  const result: AutoNfResult = {
    nf_criada: false,
    nf_id: null,
    emit_nf_disparado: false,
    erro: null,
  };

  if (!resolvedCtx.autoNfEnabled) {
    result.erro = "CORA_AUTO_NF_ENABLED=false — pagamento confirmado, NF não disparada (kill switch)";
    return result;
  }

  let modo: ModoEmissaoNf;
  try {
    modo = await fetchModoEmissaoNf(admin, cobrancaId);
  } catch (err) {
    result.erro = `modo_emissao_nf: ${err instanceof Error ? err.message : String(err)}`;
    return result;
  }

  if (modo === "data_especifica") {
    result.erro = "Paciente em modo data_especifica — NF será emitida no cron, não no pagamento";
    return result;
  }

  const { nfId, criada, erro } = await criarOuObterNfEmitivel(admin, cobrancaId);
  if (erro && !nfId) {
    result.erro = erro.startsWith("criar_nf") ? erro : `criar_nf_de_cobranca: ${erro}`;
    return result;
  }

  result.nf_criada = criada;
  if (!nfId) return result;

  result.nf_id = nfId;
  const emitResult = resolvedCtx.emitAuthHeader
    ? await triggerEmitNf(resolvedCtx.supabaseUrl, nfId, {
      mode: "user",
      authorization: resolvedCtx.emitAuthHeader,
    })
    : await triggerEmitNf(resolvedCtx.supabaseUrl, nfId, {
      mode: "internal",
      serviceKey: resolvedCtx.serviceKey,
      origin: "auto-nf-after-paid",
    });
  result.emit_nf_disparado = emitResult.ok;
  if (!emitResult.ok) result.erro = emitResult.erro;
  return result;
}

export { findNfEmitivel };
