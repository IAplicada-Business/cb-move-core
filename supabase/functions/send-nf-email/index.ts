import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { nf_id, destinatarios } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada nos Supabase Secrets." }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: nf } = await supabase
      .from("notas_fiscais")
      .select("*, pacientes(nome, email), templates_versionados(conteudo)")
      .eq("id", nf_id)
      .single();

    // ⚠️ Substituir placeholders do template
    // const template = nf.templates_versionados?.conteudo;
    // const assunto = substituirPlaceholders(template.assunto, nf);
    // const corpo = substituirPlaceholders(template.corpo, nf);

    // ⚠️ Enviar via Resend
    // const res = await fetch("https://api.resend.com/emails", { ... });

    // Registra envio
    await supabase.from("notas_fiscais_envios").insert({
      nota_fiscal_id: nf_id,
      destinatarios: destinatarios || [nf?.pacientes?.email],
      assunto: `NF emitida - ${nf?.pacientes?.nome}`,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
