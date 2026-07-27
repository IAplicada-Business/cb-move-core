import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoEnv } from "../_shared/integracao-config.ts";
import { triggerEmitNf } from "../_shared/trigger-emit-nf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Configuração Supabase incompleta");

    const admin = createClient(supabaseUrl, serviceKey);
    const cronSecret = await getIntegracaoEnv(admin, "CRON_SECRET");
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");

    const authorized =
      (cronSecret && headerSecret === cronSecret) || authHeader === `Bearer ${serviceKey}`;

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoje = new Date();
    const dia = hoje.getDate();

    const { data, error } = await admin.rpc("processar_nf_emissao_data_especifica", { p_dia: dia });
    if (error) throw error;

    const resultado = (data ?? {}) as {
      ok?: boolean;
      nf_ids?: string[];
      nfs_criadas?: number;
    };

    const nfIds = Array.isArray(resultado.nf_ids) ? resultado.nf_ids : [];
    const emissoes: { nf_id: string; ok: boolean; erro?: string }[] = [];

    for (const nfId of nfIds) {
      const emit = await triggerEmitNf(supabaseUrl, nfId, {
        mode: "internal",
        serviceKey,
        origin: "nf-emissao-data-especifica",
      });
      emissoes.push({ nf_id: nfId, ok: emit.ok, erro: emit.erro ?? undefined });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        resultado,
        emit_nf: emissoes,
        emitidas: emissoes.filter((e) => e.ok).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
