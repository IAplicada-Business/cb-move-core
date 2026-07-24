import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUserOrInternal } from "../_shared/auth.ts";
import { buildAutoNfContext, processAutoNfAfterPaid } from "../_shared/auto-nf-after-paid.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-trigger",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin } = await requireFinanceUserOrInternal(req);
    const body = await req.json().catch(() => ({}));
    const cobrancaId = typeof body?.cobranca_id === "string" ? body.cobranca_id : null;
    if (!cobrancaId) {
      return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cobranca, error: cobErr } = await admin
      .from("cobrancas")
      .select("id, status")
      .eq("id", cobrancaId)
      .maybeSingle();
    if (cobErr) throw cobErr;
    if (!cobranca) {
      return new Response(JSON.stringify({ error: "Cobrança não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cobranca.status !== "pago") {
      return new Response(JSON.stringify({ error: "Cobrança ainda não está paga" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = await buildAutoNfContext(admin);
    const authHeader = req.headers.get("Authorization");
    const result = await processAutoNfAfterPaid(admin, cobrancaId, {
      ...ctx,
      emitAuthHeader: authHeader?.startsWith("Bearer ") ? authHeader : null,
    });

    return new Response(
      JSON.stringify({ ok: true, cobranca_id: cobrancaId, ...result }),
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
