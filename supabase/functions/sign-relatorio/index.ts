import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const CLICKSIGN_TOKEN = Deno.env.get("CLICKSIGN_TOKEN");
    const { relatorio_id } = await req.json();
    if (!relatorio_id) throw new Error("relatorio_id obrigatório");

    const { data: rel } = await supabase
      .from("relatorios_atendimento")
      .select("*, pacientes(nome, email, cpf)")
      .eq("id", relatorio_id)
      .single();
    if (!rel) throw new Error("Relatório não encontrado");

    if (!CLICKSIGN_TOKEN) {
      await supabase
        .from("relatorios_atendimento")
        .update({ status: "aguardando_credencial_clicksign" })
        .eq("id", relatorio_id);
      return new Response(
        JSON.stringify({
          aviso:
            "Assinatura digital não disponível. Configure CLICKSIGN_TOKEN nos Supabase Secrets.",
          status: "aguardando_credencial_clicksign",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ⚠️ INTEGRAÇÃO CLICKSIGN — descomentar quando token configurado
    // const clicksignBase = "https://app.clicksign.com/api/v1";
    // const docRes = await fetch(`${clicksignBase}/documents`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${CLICKSIGN_TOKEN}` },
    //   body: JSON.stringify({ document: { path: `/relatorios/${relatorio_id}.pdf`, content_base64: rel.pdf_url } }),
    // });
    // const doc = await docRes.json();
    // await supabase.from("relatorios_atendimento").update({
    //   assinatura_link: doc.document.url,
    //   status: "aguardando_assinatura",
    // }).eq("id", relatorio_id);

    return new Response(
      JSON.stringify({
        aviso: "ClickSign configurado mas integração comentada — descomentar após validar token.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
