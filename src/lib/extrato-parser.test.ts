import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  diasUteisEntre,
  matchTransacoesComCobrancas,
  parseCSVBradesco,
  parseOFX,
} from "./extrato-parser";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("diasUteisEntre", () => {
  it("conta apenas dias úteis", () => {
    // sex 12/06 → seg 15/06 = 1 dia útil (pula fim de semana)
    expect(diasUteisEntre("2026-06-12", "2026-06-15")).toBe(1);
    expect(diasUteisEntre("2026-06-15", "2026-06-15")).toBe(0);
  });
});

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

  it("ignora match além de 5 dias úteis", () => {
    const matches = matchTransacoesComCobrancas(
      [{ data: "2026-06-01", descricao: "PIX", valor: 100, tipo: "credito" }],
      [
        {
          id: "cob-1",
          pacienteNome: "X",
          valor: 100,
          vencimento: "2026-06-20",
          status: "pendente",
        },
      ],
    );
    expect(matches).toHaveLength(0);
  });
});

describe("fixtures Bradesco", () => {
  const cobrancas = [
    {
      id: "paulo",
      pacienteNome: "Paulo R. Júnior",
      valor: 980,
      vencimento: "2026-06-10",
      status: "pendente",
    },
    {
      id: "marina",
      pacienteNome: "Marina Stefano",
      valor: 720,
      vencimento: "2026-06-12",
      status: "pendente",
    },
    {
      id: "amanda",
      pacienteNome: "Amanda Pavan",
      valor: 2394,
      vencimento: "2026-06-20",
      status: "pendente",
    },
  ];

  it("parseia CSV de exemplo e encontra matches", () => {
    const csv = readFileSync(join(fixturesDir, "extrato-bradesco-exemplo.csv"), "utf8");
    const txs = parseCSVBradesco(csv);
    expect(txs.filter((t) => t.tipo === "credito")).toHaveLength(4);
    const matches = matchTransacoesComCobrancas(txs, cobrancas);
    expect(matches.map((m) => m.cobrancaId).sort()).toEqual(["amanda", "marina", "paulo"]);
  });

  it("parseia OFX de exemplo e encontra matches", () => {
    const ofx = readFileSync(join(fixturesDir, "extrato-bradesco-exemplo.ofx"), "utf8");
    const txs = parseOFX(ofx);
    expect(txs.filter((t) => t.tipo === "credito")).toHaveLength(2);
    const matches = matchTransacoesComCobrancas(txs, cobrancas);
    expect(matches.map((m) => m.cobrancaId).sort()).toEqual(["marina", "paulo"]);
  });
});
