import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUser } from "../_shared/auth.ts";
import {
  emitFocusNfsen,
  loadFocusNfeConfig,
  uploadPdfFromUrl,
  type NfForFocus,
} from "../_shared/focus-nfe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function triggerSendNfEmail(
  nfId: string,
  tipo: string,
  authHeader: string | null,
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return { ok: false, error: "SUPABASE_URL ausente" };

  const eventId = `nf-emit-${nfId}`;
  const res = await fetch(`${supabaseUrl}/functions/v1/send-nf-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ nf_id: nfId, tipo, event_id: eventId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error ?? `send-nf-email retornou ${res.status}` };
  }
  return { ok: true, queued: data.queued };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin } = await requireFinanceUser(req);
    const authHeader = req.headers.get("Authorization");
    const body = await req.json();
    const { nf_id, modo, numero, pdf_url } = body;

    if (!nf_id) throw new Error("nf_id obrigatório");

    const { data: nf, error } = await admin
      .from("notas_fiscais")
      .select(`
        id, tipo, status, valor,
        competencia_mes, competencia_ano,
        destinatario_nome, destinatario_documento,
        corpo_paciente_nome, corpo_paciente_cpf,
        corpo_numero_processo, corpo_total_sessoes
      `)
      .eq("id", nf_id)
      .single();
    if (error || !nf) throw new Error("NF não encontrada");

    const mode = modo ?? "automatico";

    if (mode === "manual") {
      if (!numero || !pdf_url) {
        throw new Error("Modo manual requer numero e pdf_url");
      }

      const { error: updErr } = await admin
        .from("notas_fiscais")
        .update({
          numero,
          pdf_url,
          status: "emitida",
          emissao: new Date().toISOString().split("T")[0],
          fiscal_provider: "manual",
        })
        .eq("id", nf_id);
      if (updErr) throw updErr;

      const emailResult = await triggerSendNfEmail(nf_id, nf.tipo, authHeader);

      return new Response(
        JSON.stringify({
          ok: true,
          nf_id,
          status: "emitida",
          email: emailResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const focusConfig = await loadFocusNfeConfig(admin);
    if (!focusConfig) {
      return new Response(
        JSON.stringify({
          error:
            "Focus NFe não configurado. Defina FOCUSNFE_TOKEN e FOCUSNFE_CNPJ_PRESTADOR em integracao_config.",
          nf_id,
          adapter: "focus_nfe",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ref = `cbmove-${nf_id}`;
    let result;

    try {
      result = await emitFocusNfsen(focusConfig, ref, nf as NfForFocus);
    } catch (focusErr) {
      await admin
        .from("notas_fiscais")
        .update({ status: "erro", fiscal_provider: "focus_nfe" })
        .eq("id", nf_id);

      throw focusErr;
    }

    const emissao = new Date().toISOString().split("T")[0];
    const ano = nf.competencia_ano ?? new Date().getFullYear();
    const numeroNf = result.numero ?? `REF-${ref.slice(0, 8)}`;

    let pdfStorageUrl: string | null = null;
    if (result.pdfUrl) {
      try {
        pdfStorageUrl = await uploadPdfFromUrl(
          admin,
          result.pdfUrl,
          `nf/${ano}/${numeroNf}.pdf`,
        );
      } catch {
        pdfStorageUrl = result.pdfUrl;
      }
    }

    const { error: updErr } = await admin
      .from("notas_fiscais")
      .update({
        numero: numeroNf,
        pdf_url: pdfStorageUrl,
        status: "emitida",
        emissao,
        emitida_em: new Date().toISOString(),
        fiscal_provider: "focus_nfe",
      })
      .eq("id", nf_id);
    if (updErr) throw updErr;

    const emailResult = await triggerSendNfEmail(nf_id, nf.tipo, authHeader);

    return new Response(
      JSON.stringify({
        ok: true,
        nf_id,
        status: "emitida",
        numero: numeroNf,
        fiscal_provider: "focus_nfe",
        focus_status: result.status,
        pdf_url: pdfStorageUrl,
        email: emailResult,
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
