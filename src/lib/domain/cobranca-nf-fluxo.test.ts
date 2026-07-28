import { describe, expect, it } from "vitest";
import {
  podeMarcarComoPago,
  precisaNfAntesPagamento,
  resolverNfFluxoStatus,
} from "./cobranca-nf-fluxo";

describe("cobranca-nf-fluxo", () => {
  it("exige NF antes do pagamento para depósito/PIX/alvará", () => {
    expect(precisaNfAntesPagamento({ status: "pendente", formaPagamento: "deposito" })).toBe(true);
    expect(precisaNfAntesPagamento({ status: "pendente", formaPagamento: "boleto" })).toBe(false);
    expect(precisaNfAntesPagamento({ status: "pago", formaPagamento: "deposito" })).toBe(false);
  });

  it("resolve fluxo NF emitida → aguardando pagamento", () => {
    const cob = { status: "pendente" as const, formaPagamento: "deposito" as const };
    expect(resolverNfFluxoStatus(cob, null)).toBe("aguardando_nf");
    expect(resolverNfFluxoStatus(cob, "pendente")).toBe("nf_em_processamento");
    expect(resolverNfFluxoStatus(cob, "emitida")).toBe("aguardando_pagamento");
    expect(podeMarcarComoPago("aguardando_pagamento")).toBe(true);
    expect(podeMarcarComoPago("aguardando_nf")).toBe(false);
  });
});
