import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUser } from "../_shared/auth.ts";
import { buildCoraInvoicePayload, assertCoraIdempotencyKey, parseCoraInvoiceResponse } from "../_shared/cora-invoice.ts";
import { coraConfigHint, createCoraInvoice, getCoraAccessToken, resolveCoraConfig } from "../_shared/cora.ts";

function formatCoraHttpError(status: number, detail: string): string {
  const trimmed = detail.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        errors?: { code?: string; message?: string }[];
        message?: string;
      };
      const parts: string[] = [];
      for (const e of parsed.errors ?? []) {
        const code = (e.code ?? "").toLowerCase();
        if (code.includes("customer.document")) {
          parts.push("Cadastre o CPF/CNPJ do paciente.");
        } else if (code.includes("duedate")) {
          parts.push("Atualize o vencimento para hoje ou uma data futura.");
        } else if (code.includes("customer.email")) {
          parts.push("Cadastre o e-mail do paciente.");
        } else if (e.message) {
          parts.push(e.message);
        }
      }
      if (parts.length > 0) return parts.join(" ");
      if (parsed.message) return parsed.message;
    } catch {
      /* ignore */
    }
  }
  return `Cora recusou a emissão (${status}): ${trimmed.slice(0, 200)}`;
}const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin } = await requireFinanceUser(req);
    const body = await req.json();
    const { cobranca_id, modo, boleto_url, cora_invoice_id } = body;

    if (!cobranca_id) throw new Error("cobranca_id obrigatório");

    const { data: cob, error: cobErr } = await admin
      .from("cobrancas")
      .select("*, pacientes(nome, cpf, email, telefone)")
      .eq("id", cobranca_id)
      .single();
    if (cobErr || !cob) throw new Error("Cobrança não encontrada");

    if (!cob.vencimento) {
      throw new Error("Data de vencimento é obrigatória para emitir boleto Cora");
    }
    if (modo === "manual") {
      if (!boleto_url) throw new Error("modo manual requer boleto_url");
      const { error: updErr } = await admin
        .from("cobrancas")
        .update({
          boleto_url,
          cora_invoice_id: cora_invoice_id ?? null,
        })
        .eq("id", cobranca_id);
      if (updErr) throw updErr;

      return new Response(
        JSON.stringify({ ok: true, cobranca_id, boleto_url, modo: "manual" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const coraConfig = await resolveCoraConfig(admin);

    if (!coraConfig) {
      return new Response(
        JSON.stringify({
          error: `Integração Cora não configurada. Use modo manual ou ${coraConfigHint()}`,
          cobranca_id,
          valor: cob.valor,
          modo_manual: {
            exemplo: { cobranca_id, modo: "manual", boleto_url: "https://..." },
          },
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await getCoraAccessToken(coraConfig);

    const paciente = cob.pacientes as {
      nome: string;
      cpf: string | null;
      email: string | null;
      telefone: string | null;
    } | null;

    const invoicePayload = buildCoraInvoicePayload({
      code: cobranca_id,
      customerName: paciente?.nome ?? "Paciente",
      customerEmail: paciente?.email,
      customerDocument: paciente?.cpf,
      serviceName: cob.servico ?? "Fisioterapia CB MOVE",
      serviceDescription: cob.servico ?? "Fisioterapia neurológica CB MOVE",
      amountCents: Math.round(Number(cob.valor) * 100),
      dueDate: cob.vencimento,
      includePix: true,
      sendEmailNotification: Boolean(paciente?.email),
    });

    assertCoraIdempotencyKey(cobranca_id);
    const invoiceRes = await createCoraInvoice(coraConfig, token, invoicePayload, cobranca_id);

    if (!invoiceRes.ok) {
      const detail = await invoiceRes.text();
      throw new Error(formatCoraHttpError(invoiceRes.status, detail));
    }
    const invoice = (await invoiceRes.json()) as Record<string, unknown>;
    const parsed = parseCoraInvoiceResponse(invoice);
    const paymentUrl = parsed.boletoUrl;
    const invoiceId = parsed.id;

    const { error: updErr } = await admin
      .from("cobrancas")
      .update({
        boleto_url: paymentUrl,
        cora_invoice_id: invoiceId,
        pix_emv: parsed.pixEmv,
      })
      .eq("id", cobranca_id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        ok: true,
        cobranca_id,
        boleto_url: paymentUrl,
        cora_invoice_id: invoiceId,
        status: parsed.status,
        digitable_line: parsed.digitableLine,
        pix_emv: parsed.pixEmv,
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
