import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegracaoEnv } from "../_shared/integracao-config.ts";
import { triggerEmitBoletoCora } from "../_shared/trigger-emit-boleto-cora.ts";
import { triggerSendBoletoCobranca } from "../_shared/trigger-send-boleto-cobranca.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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
      (cronSecret && headerSecret === cronSecret) ||
      authHeader === `Bearer ${serviceKey}`;

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoje = new Date();
    const dia = hoje.getDate();

    const { data, error } = await admin.rpc("processar_boleto_emissao_data_especifica", { p_dia: dia });
    if (error) throw error;

    const resultado = (data ?? {}) as {
      ok?: boolean;
      cobranca_ids?: string[];
      cobrancas_criadas?: number;
    };

    const cobrancaIds = Array.isArray(resultado.cobranca_ids) ? resultado.cobranca_ids : [];
    const emissoes: { cobranca_id: string; ok: boolean; envio_ok?: boolean; erro?: string; envio_erro?: string }[] =
      [];

    for (const cobrancaId of cobrancaIds) {
      const emit = await triggerEmitBoletoCora(
        supabaseUrl,
        serviceKey,
        cobrancaId,
        "boleto-emissao-data-especifica",
      );

      let envioOk: boolean | undefined;
      let envioErro: string | undefined;
      if (emit.ok) {
        const envio = await triggerSendBoletoCobranca(
          supabaseUrl,
          serviceKey,
          cobrancaId,
          "boleto-emissao-data-especifica",
        );
        envioOk = envio.ok;
        envioErro = envio.erro ?? undefined;
      }

      emissoes.push({
        cobranca_id: cobrancaId,
        ok: emit.ok,
        erro: emit.erro ?? undefined,
        envio_ok: envioOk,
        envio_erro: envioErro,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        resultado,
        emit_boleto: emissoes,
        emitidos: emissoes.filter((e) => e.ok).length,
        enviados: emissoes.filter((e) => e.envio_ok).length,
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
