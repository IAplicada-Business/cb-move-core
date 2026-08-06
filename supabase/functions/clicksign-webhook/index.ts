import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  clicksignGetDocument,
  extractSignedPdfUrl,
  verifyClickSignWebhook,
} from "../_shared/clicksign.ts";
import { resolveStoragePathFromPdfRef } from "../_shared/relatorio-atendimento-linhas.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  try {
    const authorized = await verifyClickSignWebhook(
      new Request(req.url, { method: req.method, headers: req.headers, body: rawBody }),
    );
    if (!authorized) {
      return new Response("unauthorized", { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = JSON.parse(rawBody);
    const docKey = payload?.event?.data?.document?.key ?? payload?.document?.key;
    const eventName = payload?.event?.name;

    if (!docKey) return new Response("ok", { status: 200 });

    if (eventName !== "auto_close" && eventName !== "close") {
      return new Response("ok", { status: 200 });
    }

    const { data: relatorio } = await supabase
      .from("relatorios_atendimento")
      .select("id, pdf_url, assinado, paciente_id, competencia_mes, competencia_ano")
      .eq("clicksign_document_key", docKey)
      .maybeSingle();

    if (!relatorio?.id) {
      return new Response("ok", { status: 200 });
    }

    if (relatorio.assinado) {
      return new Response("ok", { status: 200 });
    }

    let pdfUrl = relatorio.pdf_url;
    try {
      const doc = await clicksignGetDocument(docKey);
      const signedUrl = extractSignedPdfUrl(doc);
      if (signedUrl) {
        const pdfRes = await fetch(signedUrl);
        if (pdfRes.ok) {
          const bytes = new Uint8Array(await pdfRes.arrayBuffer());
          const storagePath =
            resolveStoragePathFromPdfRef(relatorio.pdf_url) ??
            `relatorio-${relatorio.paciente_id}-${relatorio.competencia_ano}-${String(relatorio.competencia_mes).padStart(2, "0")}-assinado.pdf`;

          const { error: uploadErr } = await supabase.storage
            .from("relatorios-atendimento")
            .upload(storagePath, bytes, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (!uploadErr) {
            const { data: pub } = supabase.storage
              .from("relatorios-atendimento")
              .getPublicUrl(storagePath);
            pdfUrl = pub.publicUrl;
          }
        }
      }
    } catch {
      // Mantém PDF original se download falhar; status ainda marca assinado via ClickSign
    }

    await supabase
      .from("relatorios_atendimento")
      .update({
        assinado: true,
        assinado_em: new Date().toISOString(),
        status: "assinado",
        ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
      })
      .eq("id", relatorio.id);

    return new Response("ok", { status: 200 });
  } catch {
    return new Response("error", { status: 500 });
  }
});
