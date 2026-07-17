import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um assistente clínico especializado em fisioterapia neurológica.
Recebe uma transcrição bruta de evolução clínica ditada pelo fisioterapeuta e deve estruturá-la no formato SOAP.

Retorne APENAS um objeto JSON válido com exatamente estas chaves:
{
  "subjetivo": "queixa principal, relato do paciente, sensações, humor",
  "objetivo": "achados clínicos, escalas aplicadas, medidas, observações diretas do fisio",
  "plano": "condutas realizadas, exercícios, metas para próxima sessão"
}

Se a transcrição não tiver conteúdo claro para um campo, deixe a string vazia.
Não inclua mais nenhuma chave ou texto fora do JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const body = await req.json();
    const transcricao_raw: string = body.transcricao_raw ?? "";

    if (!transcricao_raw.trim()) {
      throw new Error("Campo 'transcricao_raw' ausente ou vazio");
    }

    // Sem credencial → devolve transcrição bruta sem estruturação S/O/P
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          transcricao_raw,
          subjetivo: "",
          objetivo: "",
          plano: "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Estruturação S/O/P via Claude Haiku — qualquer falha aqui (rate limit, sem
    // crédito, timeout, JSON inválido) NUNCA deve descartar a transcrição já
    // capturada no navegador. Por isso este bloco não relança erro: sempre
    // devolve transcricao_raw, com S/O/P vazio + aviso quando a IA falhar.
    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Transcrição da evolução:\n\n${transcricao_raw}`,
            },
          ],
          system: SYSTEM_PROMPT,
        }),
      });

      if (!anthropicRes.ok) {
        const errBody = await anthropicRes.text();
        console.error("Anthropic error:", anthropicRes.status, errBody);
        return new Response(
          JSON.stringify({
            transcricao_raw,
            subjetivo: "",
            objetivo: "",
            plano: "",
            aviso: anthropicRes.status === 429
              ? "IA sem créditos/limite atingido — transcrição salva, preencha S/O/P manualmente."
              : "IA indisponível no momento — transcrição salva, preencha S/O/P manualmente.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const anthropicData = await anthropicRes.json();
      const rawContent = anthropicData.content?.[0]?.text ?? "{}";

      let soap = { subjetivo: "", objetivo: "", plano: "" };
      try {
        soap = JSON.parse(rawContent);
      } catch {
        // Se Claude não retornou JSON puro, coloca tudo no subjetivo
        soap.subjetivo = rawContent;
      }

      // Registra uso (custo Haiku: $0.25/MTok input, $1.25/MTok output)
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from("creditos_ia_uso").insert({
          tipo: "estruturacao_soap",
          tokens_entrada: anthropicData.usage?.input_tokens ?? 0,
          tokens_saida: anthropicData.usage?.output_tokens ?? 0,
          custo_estimado_usd:
            ((anthropicData.usage?.input_tokens ?? 0) * 0.00000025) +
            ((anthropicData.usage?.output_tokens ?? 0) * 0.00000125),
        });
      } catch { /* silencia */ }

      return new Response(
        JSON.stringify({ transcricao_raw, ...soap }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (aiErr) {
      console.error("Falha ao estruturar via IA:", aiErr);
      return new Response(
        JSON.stringify({
          transcricao_raw,
          subjetivo: "",
          objetivo: "",
          plano: "",
          aviso: "IA indisponível no momento — transcrição salva, preencha S/O/P manualmente.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
