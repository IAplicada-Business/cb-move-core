import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyFocusNfsenWebhook,
  verifyFocusWebhookSecret,
} from "../_shared/focus-nfe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authorized = await verifyFocusWebhookSecret(admin, req);
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const result = await applyFocusNfsenWebhook(admin, payload);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("focus-nfe-webhook:", err);
    // 200 evita retentativas infinitas em payload inválido; Focus reenvia em falhas 5xx
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Erro interno",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
