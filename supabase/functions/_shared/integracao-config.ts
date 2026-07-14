import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENV_KEYS = [
  "N8N_WEBHOOK_NF_EMAIL",
  "N8N_WEBHOOK_BOLETO_DOCS",
  "N8N_WEBHOOK_SECRET",
  "CORA_CLIENT_ID",
  "CORA_CLIENT_SECRET",
  "CORA_CERTIFICATE",
  "CORA_PRIVATE_KEY",
  "CORA_API_BASE",
  "CRON_SECRET",
  "FOCUSNFE_TOKEN",
  "FOCUSNFE_AMBIENTE",
  "FOCUSNFE_CNPJ_PRESTADOR",
  "FOCUSNFE_INSCRICAO_MUNICIPAL",
  "FOCUSNFE_CODIGO_TRIBUTACAO",
  "FOCUSNFE_CODIGO_NBS",
  "FOCUSNFE_SIMPLES_NACIONAL",
  "FOCUSNFE_REGIME_TRIBUTARIO_SN",
  "FOCUSNFE_PERCENTUAL_TRIBUTOS_SN",
  "FOCUSNFE_WEBHOOK_SECRET",
] as const;

export type IntegracaoEnvKey = (typeof ENV_KEYS)[number];

/** Lê env do Deno ou, se ausente, da tabela integracao_config (service_role). */
export async function getIntegracaoConfigValue(
  admin: SupabaseClient,
  chave: string,
): Promise<string | null> {
  const fromEnv = Deno.env.get(chave);
  if (fromEnv) return fromEnv;

  const { data, error } = await admin
    .from("integracao_config")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();

  if (error || !data?.valor) return null;
  return String(data.valor);
}

export async function getIntegracaoEnv(
  admin: SupabaseClient,
  chave: IntegracaoEnvKey,
): Promise<string | null> {
  return getIntegracaoConfigValue(admin, chave);
}
