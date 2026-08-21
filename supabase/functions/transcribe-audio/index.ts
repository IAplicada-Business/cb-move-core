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

function parseSoapJson(rawContent: string): { subjetivo: string; objetivo: string; plano: string } {
  const empty = { subjetivo: "", objetivo: "", plano: "" };
  const trimmed = rawContent.trim();
  if (!trimmed) return empty;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      subjetivo: String(parsed.subjetivo ?? "").trim(),
      objetivo: String(parsed.objetivo ?? "").trim(),
      plano: String(parsed.plano ?? "").trim(),
    };
  } catch {
    return { subjetivo: trimmed, objetivo: "", plano: "" };
  }
}

function extensionForMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Transcreve áudio via Groq Whisper (preferido) ou OpenAI Whisper. */
async function transcribeAudioBase64(
  audioBase64: string,
  mimeType: string,
): Promise<{ text: string; provider: string }> {
  const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const ext = extensionForMime(mimeType);
  const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
  const file = new File([blob], `evolucao.${ext}`, { type: mimeType || "audio/webm" });

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (groqKey) {
    const form = new FormData();
    form.append("file", file);
    form.append("model", "whisper-large-v3");
    form.append("language", "pt");
    form.append("response_format", "json");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Groq Whisper falhou (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { text?: string };
    return { text: (data.text ?? "").trim(), provider: "groq" };
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    const form = new FormData();
    form.append("file", file);
    form.append("model", "whisper-1");
    form.append("language", "pt");
    form.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`OpenAI Whisper falhou (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { text?: string };
    return { text: (data.text ?? "").trim(), provider: "openai" };
  }

  throw new Error(
    "Transcrição de áudio não configurada. Defina GROQ_API_KEY ou OPENAI_API_KEY nos secrets do Supabase.",
  );
}

async function structureSoap(
  transcricao_raw: string,
  anthropicKey: string | undefined,
): Promise<{
  subjetivo: string;
  objetivo: string;
  plano: string;
  aviso?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}> {
  if (!anthropicKey) {
    return {
      subjetivo: "",
      objetivo: "",
      plano: "",
      aviso: "Configure ANTHROPIC_API_KEY para estruturação automática S/O/P.",
    };
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
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
      return {
        subjetivo: "",
        objetivo: "",
        plano: "",
        aviso:
          anthropicRes.status === 429
            ? "IA sem créditos/limite atingido — transcrição salva, preencha S/O/P manualmente."
            : "IA indisponível no momento — transcrição salva, preencha S/O/P manualmente.",
      };
    }

    const anthropicData = await anthropicRes.json();
    const rawContent = anthropicData.content?.[0]?.text ?? "{}";
    const soap = parseSoapJson(rawContent);
    return {
      ...soap,
      usage: anthropicData.usage,
    };
  } catch (aiErr) {
    console.error("Falha ao estruturar via IA:", aiErr);
    return {
      subjetivo: "",
      objetivo: "",
      plano: "",
      aviso: "IA indisponível no momento — transcrição salva, preencha S/O/P manualmente.",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const body = await req.json();

    let transcricao_raw: string = body.transcricao_raw ?? "";
    const audio_base64: string | undefined = body.audio_base64;
    const mime_type: string = body.mime_type ?? "audio/webm";

    if (audio_base64?.trim()) {
      const { text, provider } = await transcribeAudioBase64(audio_base64, mime_type);
      if (!text) {
        throw new Error("Não foi possível transcrever o áudio (silêncio ou áudio inválido)");
      }
      transcricao_raw = text;

      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.from("creditos_ia_uso").insert({
          tipo: "transcricao_audio",
          tokens_entrada: 0,
          tokens_saida: 0,
          custo_estimado_usd: provider === "groq" ? 0.0005 : 0.006,
        });
      } catch {
        /* silencia */
      }
    }

    if (!transcricao_raw.trim()) {
      throw new Error("Campo 'transcricao_raw' ou 'audio_base64' ausente ou vazio");
    }

    const soap = await structureSoap(transcricao_raw, ANTHROPIC_API_KEY);

    if (soap.usage) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.from("creditos_ia_uso").insert({
          tipo: "estruturacao_soap",
          tokens_entrada: soap.usage.input_tokens ?? 0,
          tokens_saida: soap.usage.output_tokens ?? 0,
          custo_estimado_usd:
            (soap.usage.input_tokens ?? 0) * 0.00000025 +
            (soap.usage.output_tokens ?? 0) * 0.00000125,
        });
      } catch {
        /* silencia */
      }
    }

    const { usage: _usage, ...soapFields } = soap;
    return new Response(JSON.stringify({ transcricao_raw, ...soapFields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
