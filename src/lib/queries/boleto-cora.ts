import { supabase } from "@/integrations/supabase/client";
import { updateCobranca } from "@/lib/queries/cobrancas";

export type EmitBoletoCoraResult = {
  ok: boolean;
  cobrancaId: string;
  boletoUrl: string | null;
  coraInvoiceId: string | null;
};

export class CoraNaoConfiguradaError extends Error {
  constructor(
    message = "Integração Cora não configurada. Configure CORA_CLIENT_ID e CORA_CLIENT_SECRET em Integrações (ou aguarde as credenciais da API).",
  ) {
    super(message);
    this.name = "CoraNaoConfiguradaError";
  }
}

function isCoraNaoConfigurada(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("não configurada") ||
    m.includes("nao configurada") ||
    m.includes("cora_client_id") ||
    m.includes("modo manual")
  );
}

async function extractErrorMessage(error: unknown, data: unknown): Promise<string | null> {
  const body = data as { error?: string } | null;
  if (body?.error) return body.error;

  if (error && typeof error === "object" && "context" in error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const cloned = ctx.clone?.() ?? ctx;
        const j = (await cloned.json()) as { error?: string };
        if (j?.error) return j.error;
      } catch {
        /* ignore */
      }
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return null;
}

/**
 * Emite boleto via edge emit-boleto-cora (API Cora).
 * Sem credenciais a edge responde 501 — propaga CoraNaoConfiguradaError.
 */
export async function emitBoletoCora(cobrancaId: string): Promise<EmitBoletoCoraResult> {
  await updateCobranca(cobrancaId, { formaPagamento: "boleto" });

  const { data, error } = await supabase.functions.invoke("emit-boleto-cora", {
    body: { cobranca_id: cobrancaId },
  });

  const body = data as {
    ok?: boolean;
    error?: string;
    cobranca_id?: string;
    boleto_url?: string | null;
    cora_invoice_id?: string | null;
  } | null;

  if (error || body?.error) {
    const msg = (await extractErrorMessage(error, data)) ?? "Falha ao emitir boleto Cora";
    if (isCoraNaoConfigurada(msg)) throw new CoraNaoConfiguradaError(msg);
    throw new Error(msg);
  }

  return {
    ok: Boolean(body?.ok),
    cobrancaId: body?.cobranca_id ?? cobrancaId,
    boletoUrl: body?.boleto_url ?? null,
    coraInvoiceId: body?.cora_invoice_id ?? null,
  };
}
