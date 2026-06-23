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

    const { nf_id } = await req.json();
    if (!nf_id) throw new Error("nf_id obrigatório");

    const { data: nf, error } = await supabase
      .from("notas_fiscais")
      .select("*, pacientes(nome, cpf), templates_versionados(*)")
      .eq("id", nf_id)
      .single();
    if (error || !nf) throw new Error("NF não encontrada");

    // ⚠️ INTEGRAÇÃO SAFE NOTAS — descomentar quando credenciais forem fornecidas
    // const SAFE_NOTAS_TOKEN = Deno.env.get("SAFE_NOTAS_TOKEN")!;
    // ... chamada à API Safe Notas ...
    // ... salvar PDF no Storage 'notas-fiscais' ...
    // ... chamar send-nf-email ...

    return new Response(
      JSON.stringify({
        error: "Integração Safe Notas não configurada. Configure SAFE_NOTAS_TOKEN nos Supabase Secrets.",
        nf_id,
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
