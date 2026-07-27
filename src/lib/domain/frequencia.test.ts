import { describe, expect, it } from "vitest";
import {
  calcularMetricaComparecimento,
  deveEspelharSiglaStatus,
  estimarSessoesEsperadasMes,
  formatarResumoComparecimento,
  resolveMoveSessaoSiglaDia,
  resolverSessoesEsperadas,
  siglaEspelhoFromStatus,
  statusAgendamentoFromSigla,
} from "./frequencia";

describe("statusAgendamentoFromSigla", () => {
  it("mapeia P e RC para realizado", () => {
    expect(statusAgendamentoFromSigla("P")).toBe("realizado");
    expect(statusAgendamentoFromSigla("RC")).toBe("realizado");
  });

  it("mapeia demais siglas para faltou", () => {
    expect(statusAgendamentoFromSigla("F")).toBe("faltou");
    expect(statusAgendamentoFromSigla("FJ")).toBe("faltou");
    expect(statusAgendamentoFromSigla("NJ")).toBe("faltou");
    expect(statusAgendamentoFromSigla("NR")).toBe("faltou");
  });
});

describe("deveEspelharSiglaStatus", () => {
  it("espelha quando não há marcação ou é P/F genérico", () => {
    expect(deveEspelharSiglaStatus(null, "P")).toBe(true);
    expect(deveEspelharSiglaStatus("P", "F")).toBe(true);
    expect(deveEspelharSiglaStatus("F", "P")).toBe(true);
  });

  it("preserva siglas finas", () => {
    expect(deveEspelharSiglaStatus("FJ", "F")).toBe(false);
    expect(deveEspelharSiglaStatus("RC", "P")).toBe(false);
    expect(deveEspelharSiglaStatus("NJ", "F")).toBe(false);
  });
});

describe("resolveMoveSessaoSiglaDia", () => {
  it("não faz nada sem sigla na origem", () => {
    expect(resolveMoveSessaoSiglaDia({ siglaOrigem: null, siglaDestino: null })).toEqual({
      acao: "none",
    });
  });

  it("move quando destino está vazio", () => {
    expect(resolveMoveSessaoSiglaDia({ siglaOrigem: "FJ", siglaDestino: null })).toEqual({
      acao: "move",
      sigla: "FJ",
    });
  });

  it("só limpa origem quando destino já tem marcação", () => {
    expect(resolveMoveSessaoSiglaDia({ siglaOrigem: "FJ", siglaDestino: "P" })).toEqual({
      acao: "clear_only",
    });
  });
});

describe("siglaEspelhoFromStatus", () => {
  it("mapeia status para P/F", () => {
    expect(siglaEspelhoFromStatus("realizado")).toBe("P");
    expect(siglaEspelhoFromStatus("faltou")).toBe("F");
    expect(siglaEspelhoFromStatus("agendado")).toBeNull();
  });
});

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
      [{ sigla: "P" }, { sigla: "RC" }, { sigla: "F" }, { sigla: "NJ" }],
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
