import { describe, expect, it } from "vitest";
import {
  calcularMetricaComparecimento,
  estimarSessoesEsperadasMes,
  formatarResumoComparecimento,
  resolverSessoesEsperadas,
} from "./frequencia";

describe("estimarSessoesEsperadasMes", () => {
  it("calcula sessões para planos simples, duplo e triplo", () => {
    expect(estimarSessoesEsperadasMes("2x semana simples")).toBe(8);
    expect(estimarSessoesEsperadasMes("2x semana duplo")).toBe(16);
    expect(estimarSessoesEsperadasMes("2x semana triplo")).toBe(24);
    expect(estimarSessoesEsperadasMes("5x semana duplo")).toBe(40);
  });

  it("retorna null quando não reconhece o padrão", () => {
    expect(estimarSessoesEsperadasMes(null)).toBeNull();
    expect(estimarSessoesEsperadasMes("Plano mensal")).toBeNull();
  });
});

describe("resolverSessoesEsperadas", () => {
  it("prioriza qtd_sessoes da cobrança", () => {
    expect(
      resolverSessoesEsperadas({
        qtdSessoesCobranca: 17,
        frequenciaAtendimento: "2x semana triplo",
      }),
    ).toBe(17);
  });

  it("usa frequência cadastrada quando não há qtd_sessoes", () => {
    expect(
      resolverSessoesEsperadas({
        qtdSessoesCobranca: null,
        frequenciaAtendimento: "2x semana triplo",
      }),
    ).toBe(24);
  });
});

describe("calcularMetricaComparecimento", () => {
  it("conta P e RC como realizadas", () => {
    const metrica = calcularMetricaComparecimento(
      [
        { sigla: "P" },
        { sigla: "RC" },
        { sigla: "F" },
        { sigla: "NJ" },
      ],
      { qtdSessoesCobranca: 20, frequenciaAtendimento: "2x semana triplo" },
    );

    expect(metrica.realizadas).toBe(2);
    expect(metrica.esperadas).toBe(20);
    expect(metrica.taxa).toBeCloseTo(0.1);
    expect(formatarResumoComparecimento(metrica)).toBe("2/20 · 10%");
  });

  it("limita taxa em 100%", () => {
    const metrica = calcularMetricaComparecimento(
      Array.from({ length: 22 }, () => ({ sigla: "P" as const })),
      { qtdSessoesCobranca: 20, frequenciaAtendimento: "2x semana triplo" },
    );

    expect(metrica.realizadas).toBe(22);
    expect(metrica.taxa).toBe(1);
  });
});
