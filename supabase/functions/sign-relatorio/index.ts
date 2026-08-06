import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { authErrorResponse, requireRelatorioStaffUser } from "../_shared/auth.ts";
import {
  clicksignAddSignerToDocument,
  clicksignAdminEmail,
  clicksignCreateSigner,
  clicksignToken,
} from "../_shared/clicksign.ts";
import { resolveStoragePathFromPdfRef } from "../_shared/relatorio-atendimento-linhas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RelatorioRow = {
  id: string;
  paciente_id: string;
  pdf_url: string | null;
  clicksign_document_key: string | null;
  assinado: boolean;
  status: string | null;
};

async function resolveFisioSigner(
  admin: ReturnType<typeof createClient>,
  pacienteId: string,
): Promise<{ email: string; name: string }> {
  const { data: paciente, error } = await admin
    .from("pacientes")
    .select("fisioterapeuta_id, fisioterapeutas(nome, email)")
    .eq("id", pacienteId)
    .single();

  if (error || !paciente) throw new Error("Paciente não encontrado");

  const fisio = paciente.fisioterapeutas as { nome: string; email: string | null } | null;
  let email = fisio?.email?.trim() ?? "";
  const name = fisio?.nome?.trim() || "Fisioterapeuta";

  if (!email && paciente.fisioterapeuta_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("fisioterapeuta_id", paciente.fisioterapeuta_id)
      .not("email", "is", null)
      .limit(1)
      .maybeSingle();
    email = profile?.email?.trim() ?? "";
  }

  if (!email) {
    throw new Error(
      "E-mail do fisioterapeuta não cadastrado. Atualize o cadastro do fisio antes de solicitar assinatura.",
    );
  }

  return { email, name };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const { relatorio_id } = await req.json();
    if (!relatorio_id) throw new Error("relatorio_id obrigatório");

    const { data: rel, error: relErr } = await supabase
      .from("relatorios_atendimento")
      .select("id, paciente_id, pdf_url, clicksign_document_key, assinado, status")
      .eq("id", relatorio_id)
      .single();

    if (relErr || !rel) throw new Error("Relatório não encontrado");
    const relatorio = rel as RelatorioRow;

    const { admin } = await requireRelatorioStaffUser(req, relatorio.paciente_id);

    if (relatorio.assinado) {
      return new Response(JSON.stringify({ status: "assinado", aviso: "Relatório já assinado." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (relatorio.clicksign_document_key && relatorio.status === "aguardando_assinatura") {
      const { data: existing } = await admin
        .from("relatorios_atendimento")
        .select("assinatura_link, status")
        .eq("id", relatorio_id)
        .single();
      return new Response(
        JSON.stringify({
          status: existing?.status ?? "aguardando_assinatura",
          assinatura_link: existing?.assinatura_link ?? null,
          aviso: "Solicitação de assinatura já enviada.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const CLICKSIGN_TOKEN = clicksignToken();

    if (!CLICKSIGN_TOKEN) {
      await admin
        .from("relatorios_atendimento")
        .update({ status: "aguardando_credencial_clicksign" })
        .eq("id", relatorio_id);
      return new Response(
        JSON.stringify({
          aviso:
            "Assinatura digital não disponível. Configure CLICKSIGN_TOKEN nos Supabase Secrets.",
          status: "aguardando_credencial_clicksign",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!relatorio.pdf_url) {
      throw new Error("Gere o PDF do relatório antes de solicitar assinatura.");
    }

    const storagePath = resolveStoragePathFromPdfRef(relatorio.pdf_url);
    if (!storagePath) throw new Error("Referência do PDF inválida");

    const { data: fileBlob, error: dlErr } = await admin.storage
      .from("relatorios-atendimento")
      .download(storagePath);
    if (dlErr || !fileBlob) {
      throw new Error(`Falha ao baixar PDF: ${dlErr?.message ?? "arquivo ausente"}`);
    }

    const pdfBytes = new Uint8Array(await fileBlob.arrayBuffer());
    const contentBase64 = base64Encode(pdfBytes);

    const clicksignBase = Deno.env.get("CLICKSIGN_BASE_URL") ?? "https://app.clicksign.com/api/v1";
    const docRes = await fetch(`${clicksignBase}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLICKSIGN_TOKEN}`,
      },
      body: JSON.stringify({
        document: {
          path: `/relatorios/${relatorio_id}.pdf`,
          content_base64: contentBase64,
        },
      }),
    });

    if (!docRes.ok) {
      const errText = await docRes.text();
      throw new Error(`ClickSign: ${docRes.status} — ${errText.slice(0, 200)}`);
    }

    const doc = await docRes.json();
    const documentKey = doc?.document?.key ?? null;
    if (!documentKey) throw new Error("ClickSign não retornou document key");

    const fisioSigner = await resolveFisioSigner(admin, relatorio.paciente_id);
    const adminEmail = clicksignAdminEmail();
    const adminName = Deno.env.get("CLICKSIGN_ADMIN_SIGNER_NAME")?.trim() || "Charlene Brito";

    const fisioSignerKey = await clicksignCreateSigner(fisioSigner);
    const adminSignerKey = await clicksignCreateSigner({ email: adminEmail, name: adminName });

    const fisioList = await clicksignAddSignerToDocument({
      documentKey,
      signerKey: fisioSignerKey,
      group: 1,
    });
    await clicksignAddSignerToDocument({
      documentKey,
      signerKey: adminSignerKey,
      group: 1,
    });

    const assinaturaLink = fisioList.url;

    await admin
      .from("relatorios_atendimento")
      .update({
        assinatura_link: assinaturaLink,
        clicksign_document_key: documentKey,
        status: "aguardando_assinatura",
      })
      .eq("id", relatorio_id);

    return new Response(
      JSON.stringify({
        status: "aguardando_assinatura",
        assinatura_link: assinaturaLink,
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
