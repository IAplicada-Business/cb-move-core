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

    const { paciente_id, ano } = await req.json();
    if (!paciente_id || !ano) throw new Error("paciente_id e ano obrigatórios");

    const { data: nfs, error } = await supabase
      .from("notas_fiscais")
      .select("*, pacientes(nome, cpf)")
      .eq("paciente_id", paciente_id)
      .eq("status", "emitida")
      .gte("emissao", `${ano}-01-01`)
      .lte("emissao", `${ano}-12-31`)
      .order("emissao");

    if (error) throw error;

    const paciente = nfs?.[0]?.pacientes;
    const total = (nfs || []).reduce((s, n) => s + Number(n.valor), 0);

    // ⚠️ Gerar PDF via pdf-lib quando a lib for adicionada
    // Por enquanto retorna JSON com os dados para o frontend renderizar
    return new Response(
      JSON.stringify({
        paciente_nome: paciente?.nome,
        paciente_cpf: paciente?.cpf,
        ano,
        notas: nfs,
        total,
        rodape: `Documento gerado pela CB MOVE Neuroscience em ${new Date().toLocaleDateString('pt-BR')} — para fins de declaração anual de IR`,
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
