import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoEnv } from "./integracao-config.ts";

export type QueueBoletoCobrancaResult = {
  ok: boolean;
  queued: boolean;
  duplicate?: boolean;
  event_id: string;
  error?: string;
};

type CobrancaRow = {
  id: string;
  valor: number | string;
  vencimento: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  servico: string | null;
  boleto_url: string | null;
  pix_emv: string | null;
  pacientes: {
    nome: string;
    email: string | null;
    cpf: string | null;
    telefone: string | null;
  } | null;
};

function competenciaLabel(mes: number | null, ano: number | null): string | null {
  if (!mes || !ano) return null;
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

function telefoneValido(telefone: string | null | undefined): boolean {
  return (telefone?.replace(/\D/g, "") ?? "").length >= 10;
}

export async function queueBoletoCobranca(
  admin: SupabaseClient,
  cobrancaId: string,
  options?: { eventId?: string; reenvio?: boolean },
): Promise<QueueBoletoCobrancaResult> {
  const eventId = options?.eventId ?? `boleto-docs-${cobrancaId}-${Date.now()}`;

  const { data: cob, error: cobErr } = await admin
    .from("cobrancas")
    .select(
      "id, valor, vencimento, competencia_mes, competencia_ano, servico, boleto_url, pix_emv, pacientes(nome, email, cpf, telefone)",
    )
    .eq("id", cobrancaId)
    .single();

  if (cobErr || !cob) {
    return { ok: false, queued: false, event_id: eventId, error: "Cobrança não encontrada" };
  }

  const row = cob as CobrancaRow;
  if (!row.boleto_url) {
    return {
      ok: false,
      queued: false,
      event_id: eventId,
      error: "Gere o boleto antes de enviar ao paciente",
    };
  }

  const pac = row.pacientes;
  if (!pac?.email?.trim()) {
    return {
      ok: false,
      queued: false,
      event_id: eventId,
      error: "Cadastre o e-mail do paciente antes de enviar o boleto",
    };
  }

  if (!options?.reenvio) {
    const { data: existing } = await admin
      .from("cobrancas_envios")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return { ok: true, queued: false, duplicate: true, event_id: eventId };
    }
  }

  const webhookUrl = await getIntegracaoEnv(admin, "N8N_WEBHOOK_BOLETO_DOCS");
  if (!webhookUrl) {
    return {
      ok: false,
      queued: false,
      event_id: eventId,
      error: "Automação de envio não configurada (N8N_WEBHOOK_BOLETO_DOCS)",
    };
  }

  const temTelefone = telefoneValido(pac.telefone);
  const canais = temTelefone ? ["email", "whatsapp"] : ["email"];

  const payload = {
    event: "boleto.enviar",
    reenvio: Boolean(options?.reenvio),
    event_id: eventId,
    cobranca_id: row.id,
    valor: Number(row.valor) || 0,
    vencimento: row.vencimento,
    competencia: competenciaLabel(row.competencia_mes, row.competencia_ano),
    servico: row.servico,
    boleto_url: row.boleto_url,
    pix_emv: row.pix_emv,
    paciente: {
      nome: pac.nome,
      email: pac.email,
      cpf: pac.cpf,
      telefone: pac.telefone,
    },
    canais,
  };

  const secret = await getIntegracaoEnv(admin, "N8N_WEBHOOK_SECRET");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Webhook-Secret"] = secret;

  const n8nRes = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!n8nRes.ok) {
    const detail = await n8nRes.text();
    return {
      ok: false,
      queued: false,
      event_id: eventId,
      error: `n8n webhook falhou (${n8nRes.status}): ${detail.slice(0, 300)}`,
    };
  }

  const destinatarios = [
    pac.email.trim(),
    ...(temTelefone && pac.telefone ? [pac.telefone] : []),
  ];

  const { error: logErr } = await admin.from("cobrancas_envios").insert({
    cobranca_id: row.id,
    canais,
    destinatarios,
    event_id: eventId,
  });

  if (logErr) {
    console.error("Falha ao registrar cobrancas_envios:", logErr.message);
  }

  return { ok: true, queued: true, event_id: eventId };
}
