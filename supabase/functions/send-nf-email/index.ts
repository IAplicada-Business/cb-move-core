import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUser } from "../_shared/auth.ts";
import { queueNfEmail } from "../_shared/nf-email-queue.ts";

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

    const result = await queueNfEmail(admin, nf_id, {
      tipo,
      eventId: event_id,
      reenvio: Boolean(reenvio),
    });

    if (!result.ok) {
      const status = result.error?.includes("não configurada") ? 501 : 400;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        queued: result.queued,
        duplicate: result.duplicate ?? false,
        event_id: result.event_id,
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
