import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUser } from "../_shared/auth.ts";
import { getIntegracaoEnv } from "../_shared/integracao-config.ts";
import { buildNfEmailPayload, loadNfForEmail } from "../_shared/nf-email-payload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin } = await requireFinanceUser(req);
    const body = await req.json();
    const { nf_id, tipo, event_id, reenvio } = body;

    if (!nf_id) {
      return new Response(JSON.stringify({ error: "nf_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nf = await loadNfForEmail(admin, nf_id);
    if (nf.status !== "emitida") {
      return new Response(
        JSON.stringify({ error: "NF precisa estar com status emitida para enviar e-mail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const eventId = event_id ?? `nf-email-${nf_id}-${Date.now()}`;

    const { data: existing } = await admin
      .from("notas_fiscais_envios")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, queued: false, duplicate: true, event_id: eventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = await getIntegracaoEnv(admin, "N8N_WEBHOOK_NF_EMAIL");
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({
          error:
            "N8N_WEBHOOK_NF_EMAIL não configurada (Edge Secrets ou tabela integracao_config).",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = buildNfEmailPayload(nf, eventId, Boolean(reenvio));
    if (tipo) payload.tipo = tipo;

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
      throw new Error(`n8n webhook falhou (${n8nRes.status}): ${detail}`);
    }

    const destinatarios = [
      ...(payload.to_email ? [payload.to_email] : []),
      ...payload.cc_emails,
    ];

    const { error: logErr } = await admin.from("notas_fiscais_envios").insert({
      nota_fiscal_id: nf_id,
      destinatarios: destinatarios.length ? destinatarios : ["pendente@resolver"],
      assunto: payload.assunto_sugerido,
      event_id: eventId,
    });

    if (logErr) {
      console.error("Falha ao registrar notas_fiscais_envios:", logErr.message);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        queued: true,
        event_id: eventId,
        to_email: payload.to_email,
        cc_emails: payload.cc_emails,
        template_codigo: payload.template_codigo,
        warning: payload.to_email ? null : "to_email não resolvido — n8n deve buscar destinatário",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
