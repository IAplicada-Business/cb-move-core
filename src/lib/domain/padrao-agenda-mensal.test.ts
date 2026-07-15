import { describe, expect, it } from "vitest";
import {
  filtrarSlotsFaltantes,
  gerarSlotsFaltantesPlano,
  gerarSlotsPlanoMensal,
  montarPropostasAgendamento,
  parseDiasSemanaPt,
  sessoesPorVisita,
} from "./padrao-agenda-mensal";

describe("parseDiasSemanaPt", () => {
  it("interpreta dias explícitos", () => {
    expect(parseDiasSemanaPt("2ª e 5ª (triplos)")).toEqual([1, 4]);
    expect(parseDiasSemanaPt("3ª, 4ª, 5ª e 6ª (simples)")).toEqual([2, 3, 4, 5]);
  });

  it("interpreta intervalo 2ª a 6ª", () => {
    expect(parseDiasSemanaPt("2ª a 6ª (duplos)")).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("gerarSlotsPlanoMensal", () => {
  it("gera 24 slots para 2ª e 5ª triplos em julho/2026", () => {
    const slots = gerarSlotsPlanoMensal({
      mes: 7,
      ano: 2026,
      quantidadeMensal: 24,
      diasSemana: "2ª e 5ª (triplos)",
      frequenciaAtendimento: "2x semana triplo",
    });
    expect(slots).toHaveLength(24);
    expect(sessoesPorVisita("2ª e 5ª (triplos)", "2x semana triplo")).toBe(3);
  });
});

describe("gerarSlotsFaltantesPlano", () => {
  it("desconta agendamentos já existentes no mês", () => {
    const faltantes = gerarSlotsFaltantesPlano({
      mes: 7,
      ano: 2026,
      quantidadeMensal: 24,
      diasSemana: "2ª e 5ª (triplos)",
      frequenciaAtendimento: "2x semana triplo",
      agendamentosExistentes: [
        { inicio: "2026-07-06T08:00:00-03:00" },
        { inicio: "2026-07-09T08:00:00-03:00" },
        { inicio: "2026-07-13T08:00:00-03:00" },
        { inicio: "2026-07-16T08:00:00-03:00" },
      ],
    });
    expect(faltantes).toHaveLength(20);
  });
});

describe("montarPropostasAgendamento", () => {
  it("espaça triplos no mesmo dia pela duração", () => {
    const slots = filtrarSlotsFaltantes(
      [
        { dataIso: "2026-07-06", indicePlano: 1, sessaoNoDia: 1 },
        { dataIso: "2026-07-06", indicePlano: 2, sessaoNoDia: 2 },
        { dataIso: "2026-07-06", indicePlano: 3, sessaoNoDia: 3 },
      ],
      [],
    );
    const props = montarPropostasAgendamento({ slots, horaBase: "08:00", duracaoMin: 50 });
    expect(props.map((p) => p.horaInicio)).toEqual(["08:00", "08:50", "09:40"]);
  });
});
