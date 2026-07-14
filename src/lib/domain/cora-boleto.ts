/** Validações compartilhadas para emissão de boleto Cora (espelha edge cora-invoice.ts). */

const MIN_VALOR = 5;

export function hojeIsoBrasil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function normalizarDocumentoCora(doc: string | null | undefined): string {
  return (doc ?? "").replace(/\D/g, "");
}

export function documentoCoraValido(doc: string | null | undefined): boolean {
  const digits = normalizarDocumentoCora(doc);
  return digits.length === 11 || digits.length === 14;
}

export function vencimentoCoraValido(vencimento: string | null | undefined): boolean {
  if (!vencimento) return false;
  const due = vencimento.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due >= hojeIsoBrasil();
}

export type ValidarBoletoCoraInput = {
  cpf: string | null | undefined;
  email: string | null | undefined;
  vencimento: string | null | undefined;
  valor: number;
};

/** Retorna mensagem de erro ou null se OK. */
export function validarCobrancaParaBoletoCora(input: ValidarBoletoCoraInput): string | null {
  if (!input.vencimento?.trim()) {
    return "Informe a data de vencimento da cobrança.";
  }
  const due = input.vencimento.slice(0, 10);
  const hoje = hojeIsoBrasil();
  if (due < hoje) {
    return `O vencimento (${due.split("-").reverse().join("/")}) está no passado. Atualize para hoje (${hoje.split("-").reverse().join("/")}) ou uma data futura.`;
  }
  if (!documentoCoraValido(input.cpf)) {
    return "Cadastre o CPF ou CNPJ do paciente em Pacientes antes de emitir o boleto.";
  }
  if (!input.email?.trim()) {
    return "Cadastre o e-mail do paciente em Pacientes antes de emitir o boleto.";
  }
  if (!Number.isFinite(input.valor) || input.valor < MIN_VALOR) {
    return `Valor mínimo do boleto Cora é R$ ${MIN_VALOR.toFixed(2).replace(".", ",")}.`;
  }
  return null;
}

/** Traduz JSON de erro 400 da Cora para mensagem legível. */
export function formatCoraApiErrorBody(raw: string, httpStatus?: number): string {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        message?: string;
        errors?: { code?: string; message?: string }[];
      };
      const parts: string[] = [];
      for (const e of parsed.errors ?? []) {
        const code = (e.code ?? "").toLowerCase();
        if (code.includes("customer.document")) {
          parts.push("Cadastre o CPF/CNPJ do paciente no cadastro.");
        } else if (code.includes("duedate") || code.includes("paymentterms.duedate")) {
          parts.push("Atualize o vencimento da cobrança para hoje ou uma data futura.");
        } else if (code.includes("customer.email")) {
          parts.push("Cadastre o e-mail do paciente no cadastro.");
        } else if (e.message) {
          parts.push(e.message);
        }
      }
      if (parts.length > 0) return parts.join(" ");
      if (parsed.message) return parsed.message;
    } catch {
      /* fall through */
    }
  }

  if (httpStatus === 401) {
    return "Cora recusou autenticação (401). Verifique credenciais e autorização no Cora Web.";
  }

  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed;
}
