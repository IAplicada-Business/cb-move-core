import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoEnv } from "./integracao-config.ts";
import { buildNfEmailPayload, loadNfForEmail } from "./nf-email-payload.ts";

export type QueueNfEmailResult = {
  ok: boolean;
  queued: boolean;
  duplicate?: boolean;
  event_id: string;
  error?: string;
};

export async function queueNfEmail(
  admin: SupabaseClient,
  nfId: string,
  options?: { tipo?: string | null; eventId?: string; reenvio?: boolean },
): Promise<QueueNfEmailResult> {
  const eventId = options?.eventId ?? `nf-email-${nfId}-${Date.now()}`;

  const nf = await loadNfForEmail(admin, nfId);
  if (nf.status !== "emitida") {
    return { ok: false, queued: false, event_id: eventId, error: "NF não está emitida" };
  }

  const { data: existing } = await admin
    .from("notas_fiscais_envios")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return { ok: true, queued: false, duplicate: true, event_id: eventId };
  }

  const webhookUrl = await getIntegracaoEnv(admin, "N8N_WEBHOOK_NF_EMAIL");
  if (!webhookUrl) {
    return {
      ok: false,
      queued: false,
      event_id: eventId,
      error: "N8N_WEBHOOK_NF_EMAIL não configurada",
    };
  }

  const payload = buildNfEmailPayload(nf, eventId, Boolean(options?.reenvio));
  if (options?.tipo) payload.tipo = options.tipo;

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

  const destinatarios = [...(payload.to_email ? [payload.to_email] : []), ...payload.cc_emails];

  const { error: logErr } = await admin.from("notas_fiscais_envios").insert({
    nota_fiscal_id: nfId,
    destinatarios: destinatarios.length ? destinatarios : ["pendente@resolver"],
    assunto: payload.assunto_sugerido,
    event_id: eventId,
  });

  if (logErr) {
    console.error("Falha ao registrar notas_fiscais_envios:", logErr.message);
  }

  return { ok: true, queued: true, event_id: eventId };
}
