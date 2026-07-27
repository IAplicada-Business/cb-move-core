import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireRelatorioStaffUser } from "../_shared/auth.ts";
import { executeGerarRelatorioMensal } from "../_shared/gerar-relatorio-mensal-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { paciente_id, mes, ano, modelo_pdf: modeloPdfBody } = await req.json();
    if (!paciente_id || !mes || !ano) throw new Error("paciente_id, mes e ano obrigatórios");

    const { admin: supabase } = await requireRelatorioStaffUser(req, paciente_id);

    const result = await executeGerarRelatorioMensal(supabase, {
      paciente_id,
      mes,
      ano,
      modelo_pdf: modeloPdfBody,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
