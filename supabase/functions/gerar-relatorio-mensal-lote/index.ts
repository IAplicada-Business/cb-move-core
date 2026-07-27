import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireRelatorioLoteUser } from "../_shared/auth.ts";
import { executeGerarRelatorioMensal } from "../_shared/gerar-relatorio-mensal-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS_VALIDOS = new Set(["particular", "judicial", "convenio", "puc"]);
const LOTE_MAX_PACIENTES = 80;

type LoteItemResult = {
  paciente_id: string;
  paciente_nome: string;
  status: "ok" | "erro";
  detalhe: string;
  pdf_url?: string;
  xlsx_url?: string;
  total_sessoes?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tipo, convenio_id, mes, ano } = await req.json();
    if (!tipo || !mes || !ano) throw new Error("tipo, mes e ano obrigatórios");
    if (!TIPOS_VALIDOS.has(tipo)) throw new Error("tipo de paciente inválido");
    if (tipo === "convenio" && !convenio_id) {
      throw new Error("convenio_id obrigatório para lote de convênio");
    }

    const { admin: supabase } = await requireRelatorioLoteUser(req);

    let query = supabase
      .from("pacientes")
      .select("id, nome")
      .eq("ativo", true)
      .eq("tipo", tipo)
      .order("nome");

    if (tipo === "convenio") {
      query = query.eq("convenio_id", convenio_id);
    }

    const { data: pacientes, error: pacErr } = await query;
    if (pacErr) throw new Error(pacErr.message);
    if (!pacientes?.length) throw new Error("Nenhum paciente ativo encontrado neste escopo");
    if (pacientes.length > LOTE_MAX_PACIENTES) {
      throw new Error(
        `Lote limitado a ${LOTE_MAX_PACIENTES} pacientes (${pacientes.length} encontrados). Divida por convênio ou competência.`,
      );
    }

    const resultados: LoteItemResult[] = [];

    for (const p of pacientes) {
      try {
        const data = await executeGerarRelatorioMensal(supabase, {
          paciente_id: p.id,
          mes,
          ano,
        });
        resultados.push({
          paciente_id: p.id,
          paciente_nome: p.nome,
          status: "ok",
          detalhe: `${data.total_sessoes} sessão(ões) no período`,
          pdf_url: data.pdf_url,
          ...(data.xlsx_url ? { xlsx_url: data.xlsx_url } : {}),
          total_sessoes: data.total_sessoes,
        });
      } catch (e) {
        resultados.push({
          paciente_id: p.id,
          paciente_nome: p.nome,
          status: "erro",
          detalhe: e instanceof Error ? e.message : "Erro ao gerar relatório",
        });
      }
    }

    const ok = resultados.filter((r) => r.status === "ok").length;

    return new Response(
      JSON.stringify({
        tipo,
        convenio_id: convenio_id ?? null,
        mes,
        ano,
        total: resultados.length,
        ok,
        erros: resultados.length - ok,
        resultados,
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
