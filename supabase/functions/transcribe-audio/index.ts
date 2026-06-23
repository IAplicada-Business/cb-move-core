import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) throw new Error("Campo 'audio' ausente");

    // Sem credencial → retorna mock estruturado
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          transcricao_raw: "[placeholder — aguardando credencial OpenAI]",
          subjetivo: "",
          objetivo: "",
          plano: "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transcrição via Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "pt");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });
    if (!whisperRes.ok) throw new Error(`Whisper error: ${await whisperRes.text()}`);
    const { text: transcricao_raw } = await whisperRes.json();

    // Estruturação S/O/P via GPT-4o-mini
    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você é um assistente clínico de fisioterapia neurológica.
Estruture a transcrição de evolução clínica no formato SOAP em JSON.
Retorne: {"subjetivo": "...", "objetivo": "...", "plano": "..."}
- Subjetivo: queixa do paciente, relato, sensações
- Objetivo: achados clínicos, escalas, medidas, observações do fisio
- Plano: condutas realizadas, exercícios, objetivos próxima sessão`,
          },
          { role: "user", content: transcricao_raw },
        ],
      }),
    });
    if (!chatRes.ok) throw new Error(`GPT error: ${await chatRes.text()}`);
    const chatData = await chatRes.json();
    const soap = JSON.parse(chatData.choices[0].message.content);

    // Registra uso de IA (ignora erro se tabela não existir)
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("creditos_ia_uso").insert({
        tipo: "transcricao_audio",
        tokens_entrada: chatData.usage?.prompt_tokens ?? 0,
        tokens_saida: chatData.usage?.completion_tokens ?? 0,
      });
    } catch { /* silencia */ }

    return new Response(
      JSON.stringify({ transcricao_raw, ...soap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
