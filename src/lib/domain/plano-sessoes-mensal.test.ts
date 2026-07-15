import { describe, expect, it } from "vitest";
import {
  classificarSituacaoSessao,
  formatPlanoQuantidadeMensal,
  gerarDatasMesmoDiaSemanaNoMes,
  montarResumoPlanoSessoesMensal,
  semanaNoMes,
} from "./plano-sessoes-mensal";

describe("formatPlanoQuantidadeMensal", () => {
  it("exibe quantidade mensal do plano", () => {
    expect(formatPlanoQuantidadeMensal(3)).toBe("3x");
    expect(formatPlanoQuantidadeMensal(1)).toBe("1x");
  });

  it("retorna traço sem quantidade definida", () => {
    expect(formatPlanoQuantidadeMensal(null)).toBe("—");
  });
});

describe("montarResumoPlanoSessoesMensal", () => {
  it("conta concluídas e pendentes dentro da cota do plano", () => {
    const resumo = montarResumoPlanoSessoesMensal({
      mes: 7,
      ano: 2026,
      frequenciaLabel: "1x semana simples",
      qtdSessoesCobranca: 3,
      agendamentos: [
        { id: "1", inicio: "2026-07-07T08:00:00-03:00", status: "realizado" },
        { id: "2", inicio: "2026-07-14T08:00:00-03:00", status: "confirmado" },
        { id: "3", inicio: "2026-07-21T08:00:00-03:00", status: "agendado" },
      ],
    });

    expect(resumo.quantidadeExibicao).toBe("3x");
    expect(resumo.concluidas).toBe(1);
    expect(resumo.pendentes).toBe(2);
    expect(resumo.faltantes).toBe(0);
    expect(resumo.itens).toHaveLength(3);
    expect(resumo.extras).toHaveLength(0);
  });

  it("não conta agendamentos extras como pendentes do plano (1x/mês)", () => {
    const resumo = montarResumoPlanoSessoesMensal({
      mes: 7,
      ano: 2026,
      frequenciaLabel: "1x semana simples",
      qtdSessoesCobranca: 1,
      agendamentos: [
        { id: "1", inicio: "2026-07-13T08:00:00-03:00", status: "realizado" },
        { id: "2", inicio: "2026-07-14T08:00:00-03:00", status: "confirmado" },
        { id: "3", inicio: "2026-07-15T08:00:00-03:00", status: "agendado" },
      ],
    });

    expect(resumo.quantidadeExibicao).toBe("1x");
    expect(resumo.concluidas).toBe(1);
    expect(resumo.pendentes).toBe(0);
    expect(resumo.itens).toHaveLength(1);
    expect(resumo.extras).toHaveLength(2);
  });

  it("calcula sessões faltantes não agendadas", () => {
    const resumo = montarResumoPlanoSessoesMensal({
      mes: 7,
      ano: 2026,
      frequenciaLabel: null,
      qtdSessoesCobranca: 3,
      agendamentos: [
        { id: "1", inicio: "2026-07-14T08:00:00-03:00", status: "agendado" },
      ],
    });

    expect(resumo.faltantes).toBe(2);
    expect(resumo.faltantesSlots).toHaveLength(0);
  });

  it("Airton plano limpo: 24 no padrão, 0 faltantes, 0 extras", () => {
    const dias = [2, 6, 9, 13, 16, 20, 23, 27];
    const horas = ["08:00", "08:50", "09:40"];
    const agendamentos = dias.flatMap((dia, di) =>
      horas.map((hora, hi) => ({
        id: `${di}-${hi}`,
        inicio: `2026-07-${String(dia).padStart(2, "0")}T${hora}:00-03:00`,
        status: "agendado",
      })),
    );

    const resumo = montarResumoPlanoSessoesMensal({
      mes: 7,
      ano: 2026,
      frequenciaLabel: "2x semana triplo",
      diasSemanaLabel: "2ª e 5ª (triplos)",
      qtdSessoesCobranca: 24,
      agendamentos,
    });

    expect(resumo.faltantes).toBe(0);
    expect(resumo.extras).toHaveLength(0);
    expect(resumo.agendadasNoPlano).toBe(24);
    expect(resumo.pendentes).toBe(24);
  });

  it("Airton pós remarcação pontual: 1 faltante, 1 extra, 23 no plano", () => {
    const dias = [2, 6, 9, 13, 16, 20, 23, 27];
    const horas = ["08:00", "08:50", "09:40"];
    const agendamentos = dias.flatMap((dia, di) =>
      horas.map((hora, hi) => {
        let inicio = `2026-07-${String(dia).padStart(2, "0")}T${hora}:00-03:00`;
        if (dia === 16 && hora === "08:00") {
          inicio = "2026-07-17T08:00:00-03:00";
        }
        return { id: `${di}-${hi}`, inicio, status: "agendado" };
      }),
    );

    const resumo = montarResumoPlanoSessoesMensal({
      mes: 7,
      ano: 2026,
      frequenciaLabel: "2x semana triplo",
      diasSemanaLabel: "2ª e 5ª (triplos)",
      qtdSessoesCobranca: 24,
      agendamentos,
    });

    expect(resumo.faltantes).toBe(1);
    expect(resumo.extras).toHaveLength(1);
    expect(resumo.agendadasNoPlano).toBe(23);
    expect(resumo.pendentes).toBe(23);
    expect(resumo.faltantesSlots[0]?.dataIso).toBe("2026-07-16");
    expect(resumo.faltantesSlots[0]?.sessaoNoDia).toBe(3);
  });
});

describe("classificarSituacaoSessao", () => {
  it("mapeia status da agenda", () => {
    expect(classificarSituacaoSessao("realizado")).toBe("concluida");
    expect(classificarSituacaoSessao("confirmado")).toBe("pendente");
    expect(classificarSituacaoSessao("cancelado")).toBeNull();
  });
});

describe("semanaNoMes", () => {
  it("retorna semana do mês", () => {
    expect(semanaNoMes("2026-07-14T08:00:00-03:00")).toBeGreaterThan(0);
  });
});

describe("gerarDatasMesmoDiaSemanaNoMes", () => {
  it("gera mesmas ocorrências do dia da semana no mês", () => {
    expect(gerarDatasMesmoDiaSemanaNoMes("2026-07-14", 3)).toEqual([
      "2026-07-14",
      "2026-07-21",
      "2026-07-28",
    ]);
  });

  it("limita pela quantidade pedida", () => {
    expect(gerarDatasMesmoDiaSemanaNoMes("2026-07-07", 2)).toEqual([
      "2026-07-07",
      "2026-07-14",
    ]);
  });
});
