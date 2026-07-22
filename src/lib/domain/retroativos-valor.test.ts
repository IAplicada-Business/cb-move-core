import { describe, expect, it } from "vitest";

import { calcValorMesAtual, calcValorRetroativo, parseValorBr } from "./retroativos-valor";

describe("retroativos-valor", () => {
  it("usa valor_mensal cheio por retroativo", () => {
    expect(calcValorRetroativo(10280, 3426.66)).toBe(10280);
  });

  it("fallback para previsto quando valor_mensal ausente", () => {
    expect(calcValorRetroativo(null, 5000)).toBe(5000);
  });

  it("mes atual usa previsto da planilha", () => {
    expect(calcValorMesAtual(10280)).toBe(10280);
  });

  it("parseValorBr interpreta milhar BR", () => {
    expect(parseValorBr("10.280,00")).toBe(10280);
    expect(parseValorBr("10280,00")).toBe(10280);
  });
});
