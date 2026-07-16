import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoConfigValue } from "../_shared/integracao-config.ts";
import { syncCobrancaPorInvoiceId, syncPagamentosCoraPendentes } from "../_shared/cora-payment-sync.ts";

/**
 * Webhook da Cora (`resource: invoice`, `trigger: paid`). O corpo da notificação vem
 * sempre vazio e sem assinatura (ver docs/notas_spike_cora_stage.md) — por isso este
 * endpoint NUNCA confia no que recebe: ele só usa o evento como "campainha" para disparar
 * uma reconfirmação real via `GET /v2/invoices/{id}` (mTLS), feita em `_shared/cora-payment-sync.ts`.
 *
 * Segurança: como a Cora não assina o payload nem envia headers de auth próprios, o
 * segredo fica embutido na própria URL registrada (`?secret=...`), guardado em
 * `CORA_WEBHOOK_SHARED_SECRET`.
 *
 * Sempre responde 200 (mesmo em erro) para não gerar retentativas infinitas da Cora —
 * mesmo padrão de `focus-nfe-webhook`. `verify_jwt = false` em supabase/config.toml.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expectedSecret = await getIntegracaoConfigValue(admin, "CORA_WEBHOOK_SHARED_SECRET");
    const providedSecret = new URL(req.url).searchParams.get("secret");
    if (expectedSecret && providedSecret !== expectedSecret) {
      console.warn("[cora-webhook] segredo inválido/ausente na URL — ignorando evento");
      // 200 propositalmente: não dar pista a quem estiver tentando adivinhar a URL.
      return ok({ ok: false, ignored: true });
    }

    const eventId = req.headers.get("webhook-event-id");
    const eventType = req.headers.get("webhook-event-type");
    const resourceId = req.headers.get("webhook-resource-id");

    if (eventId) {
      const { error: dedupErr } = await admin
        .from("cobrancas_pagamentos_eventos")
        .insert({ origem: "webhook", webhook_event_id: eventId, cora_invoice_id: resourceId });
      if (dedupErr) {
        // 23505 = unique_violation -> já processamos esse webhook-event-id antes.
        if ((dedupErr as { code?: string }).code === "23505") {
          return ok({ ok: true, duplicado: true, webhook_event_id: eventId });
        }
        console.error("[cora-webhook] falha ao gravar marca de dedup", dedupErr);
      }
    }

    if (eventType && eventType !== "invoice.paid") {
      // Registramos apenas o trigger `paid`; outros eventos (created, canceled, overdue)
      // não acionam a automação de NF.
      return ok({ ok: true, ignorado_tipo: eventType });
    }

    const resultado = resourceId
      ? await syncCobrancaPorInvoiceId(admin, resourceId, "webhook")
      : await syncPagamentosCoraPendentes(admin, "webhook");

    return ok({ ok: true, resource_id: resourceId, resultado });
  } catch (err) {
    console.error("[cora-webhook] erro:", err);
    return ok({ ok: false, error: err instanceof Error ? err.message : "Erro interno" });
  }
});
