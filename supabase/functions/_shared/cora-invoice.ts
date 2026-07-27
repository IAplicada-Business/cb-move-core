/**
 * POST /v2/invoices — Emissão de boleto registrado v2 (Integração Direta mTLS).
 * @see https://developers.cora.com.br/reference/emiss%C3%A3o-de-boleto-registrado-v2
 */

const MIN_AMOUNT_CENTS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CoraDocumentType = "CPF" | "CNPJ";

export type CoraInvoiceBuildInput = {
  code: string;
  customerName: string;
  customerEmail?: string | null;
  customerDocument?: string | null;
  serviceName: string;
  serviceDescription?: string | null;
  amountCents: number;
  dueDate: string;
  /** Inclui QR Pix no boleto quando a conta Cora tiver chave Pix cadastrada. */
  includePix?: boolean;
  /** Envia lembrete por e-mail (objeto notification da API v2). */
  sendEmailNotification?: boolean;
};

export function inferCoraDocumentType(identity: string): CoraDocumentType {
  const digits = identity.replace(/\D/g, "");
  return digits.length > 11 ? "CNPJ" : "CPF";
}

/** Header Idempotency-Key — UUID obrigatório (docs v2). */
export function assertCoraIdempotencyKey(key: string): void {
  if (!UUID_RE.test(key.trim())) {
    throw new Error("Idempotency-Key deve ser UUID (use o id da cobrança no Supabase)");
  }
}

function assertDueDateNotPast(dueDate: string): void {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  if (dueDate < today) {
    throw new Error(
      `Vencimento (${dueDate}) não pode ser anterior a hoje (${today}). Atualize a cobrança antes de emitir o boleto.`,
    );
  }
}

/**
 * Monta body JSON conforme reference v2:
 * customer (name, email, document), services[], payment_terms, notification?, payment_forms?
 */
export function buildCoraInvoicePayload(input: CoraInvoiceBuildInput): Record<string, unknown> {
  const identity = input.customerDocument?.replace(/\D/g, "") ?? "";
  if (!identity || (identity.length !== 11 && identity.length !== 14)) {
    throw new Error(
      "CPF/CNPJ do paciente é obrigatório e deve ter 11 ou 14 dígitos para emitir boleto Cora",
    );
  }

  const email = input.customerEmail?.trim() ?? "";
  if (!email) {
    throw new Error("E-mail do paciente é obrigatório para emitir boleto Cora (customer.email)");
  }

  if (!Number.isFinite(input.amountCents) || input.amountCents < MIN_AMOUNT_CENTS) {
    throw new Error(`Valor mínimo do boleto Cora é R$ 5,00 (${MIN_AMOUNT_CENTS} centavos)`);
  }

  const dueDate = input.dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("Data de vencimento inválida (use AAAA-MM-DD)");
  }
  assertDueDateNotPast(dueDate);

  const customerName = input.customerName.trim().slice(0, 60) || "Paciente";
  const serviceName = input.serviceName.trim().slice(0, 100) || "Fisioterapia";
  const description = (input.serviceDescription?.trim() || serviceName).slice(0, 100);

  const payload: Record<string, unknown> = {
    code: input.code,
    customer: {
      name: customerName,
      email: email.slice(0, 60),
      document: {
        identity,
        type: inferCoraDocumentType(identity),
      },
    },
    services: [
      {
        name: serviceName,
        description,
        amount: Math.round(input.amountCents),
      },
    ],
    payment_terms: {
      due_date: dueDate,
    },
  };

  if (input.sendEmailNotification !== false) {
    payload.notification = {
      name: customerName,
      channels: [
        {
          channel: "EMAIL",
          contact: email.slice(0, 60),
          rules: ["NOTIFY_ON_DUE_DATE", "NOTIFY_WHEN_PAID"],
        },
      ],
    };
  }

  if (input.includePix !== false) {
    payload.payment_forms = ["BANK_SLIP", "PIX"];
  } else {
    payload.payment_forms = ["BANK_SLIP"];
  }

  return payload;
}

/** Extrai campos da resposta v2 (payment_options.bank_slip, pix.emv). */
export function parseCoraInvoiceResponse(invoice: Record<string, unknown>): {
  id: string | null;
  status: string | null;
  boletoUrl: string | null;
  digitableLine: string | null;
  pixEmv: string | null;
} {
  const paymentOptions = invoice.payment_options as Record<string, unknown> | undefined;
  const bankSlip = paymentOptions?.bank_slip as Record<string, unknown> | undefined;
  const pix = invoice.pix as Record<string, unknown> | null | undefined;

  return {
    id: typeof invoice.id === "string" ? invoice.id : null,
    status: typeof invoice.status === "string" ? invoice.status : null,
    boletoUrl: typeof bankSlip?.url === "string" ? bankSlip.url : null,
    digitableLine: typeof bankSlip?.digitable === "string" ? bankSlip.digitable : null,
    pixEmv: typeof pix?.emv === "string" ? pix.emv : null,
  };
}
