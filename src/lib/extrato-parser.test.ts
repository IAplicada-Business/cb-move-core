import { describe, it, expect } from "vitest";
import { matchTransacoesComCobrancas } from "./extrato-parser";

describe("matchTransacoesComCobrancas", () => {
  it("matches cobrança por valor e proximidade de data", () => {
    const transacoes = [
      { data: "2026-06-15", descricao: "PIX", valor: 980, tipo: "credito" as const },
    ];
    const cobrancas = [
      {
        id: "cob-1",
        pacienteNome: "Paulo R. Júnior",
        valor: 980,
        vencimento: "2026-06-15",
        status: "pendente",
      },
    ];

    const matches = matchTransacoesComCobrancas(transacoes, cobrancas);
    expect(matches).toHaveLength(1);
    expect(matches[0].cobrancaId).toBe("cob-1");
    expect(matches[0].confianca).toBe("alta");
    expect(matches[0].diferenca).toBeLessThanOrEqual(0.01);
  });
});
