import { updateCobranca } from "@/lib/queries/cobrancas";
import {
  formatCoraApiErrorBody,
  validarCobrancaParaBoletoCora,
} from "@/lib/domain/cora-boleto";
import { supabase } from "@/integrations/supabase/client";

export type EmitBoletoCoraResult = {
  ok: boolean;
  cobrancaId: string;
  boletoUrl: string | null;
  coraInvoiceId: string | null;
  pixEmv: string | null;
};

export class CoraNaoConfiguradaError extends Error {
  constructor(
    message = "Integração Cora não configurada. Configure CORA_CLIENT_ID + certificado/chave em Integrações (ou aguarde a IAplicada aplicar as credenciais).",
  ) {
    super(message);
    this.name = "CoraNaoConfiguradaError";
  }
}

function formatCoraError(msg: string): string {
  if (/token \(mtls\) falhou \(401\)|not authorized|access_denied/i.test(msg)) {
    return (
      "Cora recusou autenticação (401). Verifique credenciais STAGE (cert+key+Client ID) " +
      "e se a etapa de autorização da Integração Direta foi concluída no Cora Web."
    );
  }
  const statusMatch = msg.match(/Cora (?:invoice falhou|recusou)[^(]*\((\d+)\)/i);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;
  const friendly = formatCoraApiErrorBody(msg, status);
  if (friendly !== msg.trim()) return friendly;
  if (/customer\.document|cpf\/cnpj/i.test(msg)) {
    return "Cadastre o CPF/CNPJ do paciente em Pacientes antes de emitir o boleto.";
  }
  if (/customer\.email|e-mail do paciente/i.test(msg)) {
    return "Cadastre o e-mail do paciente em Pacientes antes de emitir o boleto.";
  }
  if (/payment_terms|duedate|past date|vencimento/i.test(msg)) {
    return "Atualize a data de vencimento da cobrança para hoje ou uma data futura.";
  }
  return msg;
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

export type ValidarBoletoCoraCobranca = {
  pacienteCpf?: string | null;
  pacienteEmail?: string | null;
  vencimento?: string | null;
  valor: number;
};

export function validarEmitBoletoCoraLocal(c: ValidarBoletoCoraCobranca): string | null {
  return validarCobrancaParaBoletoCora({
    cpf: c.pacienteCpf,
    email: c.pacienteEmail,
    vencimento: c.vencimento,
    valor: c.valor,
  });
}

/**
 * Emite boleto via edge emit-boleto-cora (API Cora).
 * Sem credenciais a edge responde 501 — propaga CoraNaoConfiguradaError.
 */
export async function emitBoletoCora(cobrancaId: string): Promise<EmitBoletoCoraResult> {
  const { data: row, error: loadErr } = await supabase
    .from("cobrancas")
    .select("valor, vencimento, pacientes(cpf, email)")
    .eq("id", cobrancaId)
    .single();
  if (loadErr) throw loadErr;

  const pac = row.pacientes as { cpf: string | null; email: string | null } | null;
  const localErr = validarEmitBoletoCoraLocal({
    pacienteCpf: pac?.cpf,
    pacienteEmail: pac?.email,
    vencimento: row.vencimento,
    valor: Number(row.valor) || 0,
  });
  if (localErr) throw new Error(localErr);

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
    pix_emv?: string | null;
  } | null;

  if (error || body?.error) {
    const msg = formatCoraError(
      (await extractErrorMessage(error, data)) ?? "Falha ao emitir boleto Cora",
    );
    if (isCoraNaoConfigurada(msg)) throw new CoraNaoConfiguradaError(msg);
    throw new Error(msg);
  }

  return {
    ok: Boolean(body?.ok),
    cobrancaId: body?.cobranca_id ?? cobrancaId,
    boletoUrl: body?.boleto_url ?? null,
    coraInvoiceId: body?.cora_invoice_id ?? null,
    pixEmv: body?.pix_emv ?? null,
  };
}
