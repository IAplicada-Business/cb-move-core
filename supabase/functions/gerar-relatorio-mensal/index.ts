import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MES_NOME: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
  7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

function substituirPlaceholders(template: string, dados: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => dados[key] ?? `{{${key}}}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { paciente_id, mes, ano } = await req.json();
    if (!paciente_id || !mes || !ano) throw new Error("paciente_id, mes e ano obrigatórios");

    // Busca dados do paciente
    const { data: paciente, error: pacErr } = await supabase
      .from("pacientes")
      .select("*, convenios(nome, cnpj), fisioterapeutas(nome)")
      .eq("id", paciente_id)
      .single();
    if (pacErr || !paciente) throw new Error("Paciente não encontrado");

    // Determina modelo pelo tipo do paciente e convenio
    let modelo = "convencional";
    if (paciente.modelo_relatorio_preferido === "sharepoint") modelo = "sharepoint";
    else if (paciente.modelo_relatorio_preferido === "unimed") modelo = "unimed";
    else if (paciente.tipo === "judicial") modelo = "sharepoint";
    else if (paciente.tipo === "convenio") modelo = "unimed";

    // Busca template ativo para o modelo
    const { data: template } = await supabase
      .from("templates_versionados")
      .select("*")
      .eq("status", "ativo")
      .order("versao", { ascending: false })
      .limit(1)
      .single();

    // Busca sessões do mês
    const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fimMes = new Date(ano, mes, 0).toISOString().split("T")[0];
    const { data: sessoes } = await supabase
      .from("sessoes")
      .select("*, fisioterapeutas(nome)")
      .eq("paciente_id", paciente_id)
      .gte("data", inicioMes)
      .lte("data", fimMes);

    // Busca evoluções do mês
    const { data: evolucoes } = await supabase
      .from("prontuario_evolucoes")
      .select("subjetivo, objetivo, plano, data")
      .eq("paciente_id", paciente_id)
      .gte("data", inicioMes)
      .lte("data", fimMes)
      .order("data");

    const totalSessoes = (sessoes ?? []).filter((s: { sigla?: string }) =>
      ["P", "RC"].includes(s.sigla ?? "")
    ).length;
    const evolucaoResumo = (evolucoes ?? [])
      .map((e: { subjetivo?: string; objetivo?: string; plano?: string }) =>
        [e.subjetivo, e.objetivo, e.plano].filter(Boolean).join("\n")
      )
      .join("\n\n");

    const placeholders: Record<string, string> = {
      paciente_nome: paciente.nome,
      paciente_cpf: paciente.cpf ?? "",
      competencia: `${MES_NOME[mes]}/${ano}`,
      total_sessoes: String(totalSessoes),
      evolucao_resumo: evolucaoResumo || "Sem evoluções registradas no período.",
      plano_terapeutico: evolucoes?.[evolucoes.length - 1]?.plano ?? "",
      fisio_nome: paciente.fisioterapeutas?.nome ?? "",
      processo: paciente.numero_processo ?? "",
      convenio_nome: paciente.convenios?.nome ?? "",
      convenio_cnpj: paciente.convenios?.cnpj ?? "",
    };

    const conteudo = template?.conteudo
      ? substituirPlaceholders(
          typeof template.conteudo === "string"
            ? template.conteudo
            : JSON.stringify(template.conteudo),
          placeholders
        )
      : JSON.stringify(placeholders);

    // Registra relatorio_atendimento
    const { data: relatorio, error: relErr } = await supabase
      .from("relatorios_atendimento")
      .insert({
        paciente_id,
        competencia_mes: mes,
        competencia_ano: ano,
        modelo,
        status: "gerado",
        template_versionado_id: template?.id ?? null,
      })
      .select()
      .single();
    if (relErr) throw relErr;

    return new Response(
      JSON.stringify({
        relatorio_id: relatorio.id,
        modelo,
        paciente_nome: paciente.nome,
        competencia: `${MES_NOME[mes]}/${ano}`,
        total_sessoes: totalSessoes,
        conteudo,
        aviso:
          "PDF gerado em texto — integração pdf-lib pendente. Configure a Edge Function para gerar PDF binário.",
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
