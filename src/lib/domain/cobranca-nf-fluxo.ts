import type { CobrancaStatus, FormaPagamento, NfStatus } from "@/lib/types";

/** Depósito, PIX (transferência) e alvará exigem NF emitida antes de baixa manual. */
export const FORMAS_NF_ANTES_PAGAMENTO: FormaPagamento[] = [
  "deposito",
  "transferencia",
  "alvara_judicial",
];

export type NfFluxoStatus =
  "nao_aplica" | "aguardando_nf" | "nf_em_processamento" | "nf_emitida" | "aguardando_pagamento";

export function precisaNfAntesPagamento(cobranca: {
  status: CobrancaStatus;
  formaPagamento: FormaPagamento | null;
}): boolean {
  if (cobranca.status === "pago" || cobranca.status === "cancelado") return false;
  if (!cobranca.formaPagamento) return false;
  return FORMAS_NF_ANTES_PAGAMENTO.includes(cobranca.formaPagamento);
}

const NF_EMITIDA: NfStatus[] = ["emitida", "regularizada_retroativa"];

export function resolverNfFluxoStatus(
  cobranca: { status: CobrancaStatus; formaPagamento: FormaPagamento | null },
  nfStatus: NfStatus | null | undefined,
): NfFluxoStatus {
  if (!precisaNfAntesPagamento(cobranca)) return "nao_aplica";
  if (cobranca.status === "pago") return "nao_aplica";
  if (!nfStatus) return "aguardando_nf";
  if (NF_EMITIDA.includes(nfStatus)) return "aguardando_pagamento";
  return "nf_em_processamento";
}

/** Só permite baixa manual quando a NF já foi emitida (ou não se aplica ao fluxo). */
export function podeMarcarComoPago(fluxo: NfFluxoStatus): boolean {
  return fluxo === "nao_aplica" || fluxo === "aguardando_pagamento";
}

export function labelNfFluxo(fluxo: NfFluxoStatus): string {
  switch (fluxo) {
    case "aguardando_nf":
      return "Emitir NF";
    case "nf_em_processamento":
      return "NF em processamento";
    case "aguardando_pagamento":
      return "Aguardando pagamento";
    case "nao_aplica":
    default:
      return "";
  }
}

export function classeNfFluxo(fluxo: NfFluxoStatus): string {
  switch (fluxo) {
    case "aguardando_nf":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "nf_em_processamento":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "aguardando_pagamento":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "";
  }
}
