import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUser } from "../_shared/auth.ts";
import { getIntegracaoEnv } from "../_shared/integracao-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CoraTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

async function getCoraToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Cora OAuth falhou (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as CoraTokenResponse;
  return data.access_token;
}

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

    const clientId = await getIntegracaoEnv(admin, "CORA_CLIENT_ID");
    const clientSecret = await getIntegracaoEnv(admin, "CORA_CLIENT_SECRET");
    const coraBase = (await getIntegracaoEnv(admin, "CORA_API_BASE")) ??
      "https://api.stage.cora.com.br";

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: "Integração Cora não configurada. Use modo manual ou configure CORA_CLIENT_ID e CORA_CLIENT_SECRET.",
          cobranca_id,
          valor: cob.valor,
          modo_manual: {
            exemplo: { cobranca_id, modo: "manual", boleto_url: "https://..." },
          },
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await getCoraToken(coraBase, clientId, clientSecret);

    const paciente = cob.pacientes as {
      nome: string;
      cpf: string | null;
      email: string | null;
      telefone: string | null;
    } | null;

    const invoicePayload = {
      code: cobranca_id,
      customer: {
        name: paciente?.nome ?? "Paciente",
        email: paciente?.email ?? undefined,
        document: paciente?.cpf?.replace(/\D/g, "") ?? undefined,
      },
      services: [
        {
          name: cob.servico ?? "Fisioterapia CB MOVE",
          amount: Math.round(Number(cob.valor) * 100),
        },
      ],
      payment_terms: {
        due_date: cob.vencimento ?? undefined,
      },
    };

    const invoiceRes = await fetch(`${coraBase}/v2/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": cobranca_id,
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!invoiceRes.ok) {
      const detail = await invoiceRes.text();
      throw new Error(`Cora invoice falhou (${invoiceRes.status}): ${detail}`);
    }

    const invoice = await invoiceRes.json();
    const paymentUrl =
      invoice?.payment_options?.bank_slip?.url ??
      invoice?.bank_slip?.url ??
      invoice?.url ??
      null;
    const invoiceId = invoice?.id ?? invoice?.invoice_id ?? null;

    const { error: updErr } = await admin
      .from("cobrancas")
      .update({
        boleto_url: paymentUrl,
        cora_invoice_id: invoiceId,
      })
      .eq("id", cobranca_id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        ok: true,
        cobranca_id,
        boleto_url: paymentUrl,
        cora_invoice_id: invoiceId,
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
