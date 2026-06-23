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

    const { cobranca_id } = await req.json();
    if (!cobranca_id) throw new Error("cobranca_id obrigatório");

    // Busca cobrança + paciente
    const { data: cob, error: cobErr } = await supabase
      .from("cobrancas")
      .select("*, pacientes(nome, cpf, email, telefone)")
      .eq("id", cobranca_id)
      .single();
    if (cobErr || !cob) throw new Error("Cobrança não encontrada");

    // ⚠️ INTEGRAÇÃO CORA — descomentar quando credenciais forem fornecidas
    // const CORA_CLIENT_ID = Deno.env.get("CORA_CLIENT_ID")!;
    // const CORA_CLIENT_SECRET = Deno.env.get("CORA_CLIENT_SECRET")!;
    // const CORA_BASE_URL = Deno.env.get("CORA_BASE_URL") || "https://matls-clients.api.cora.com.br";
    //
    // const token = await getCoraToken(CORA_CLIENT_ID, CORA_CLIENT_SECRET, CORA_BASE_URL);
    // const invoice = await createCoraInvoice(token, cob, CORA_BASE_URL);
    //
    // await supabase.from("cobrancas").update({
    //   boleto_url: invoice.payment_url,
    //   cora_invoice_id: invoice.id,
    // }).eq("id", cobranca_id);
    //
    // return new Response(JSON.stringify({ boleto_url: invoice.payment_url }), {
    //   headers: { ...corsHeaders, "Content-Type": "application/json" },
    // });

    // Placeholder até credenciais Cora serem configuradas
    return new Response(
      JSON.stringify({
        error: "Integração Cora não configurada. Configure CORA_CLIENT_ID e CORA_CLIENT_SECRET nos Supabase Secrets.",
        cobranca_id,
        valor: cob.valor,
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
