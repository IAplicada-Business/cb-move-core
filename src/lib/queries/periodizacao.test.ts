import { describe, expect, it } from "vitest";
import { proximoNumeroSessao, type PeriodizacaoSessao } from "./periodizacao";

describe("proximoNumeroSessao", () => {
  it("retorna 1 quando lista vazia", () => {
    expect(proximoNumeroSessao([])).toBe(1);
  });

  it("retorna max + 1", () => {
    const itens: PeriodizacaoSessao[] = [
      {
        id: "a",
        pacienteId: "p",
        numeroSessao: 3,
        objetivo: null,
        atividadesPrevistas: null,
        status: "planejada",
        sessaoId: null,
        fisioterapeutaId: null,
        fisioterapeutaNome: null,
        driveDocUrl: null,
        updatedAt: "",
      },
      {
        id: "b",
        pacienteId: "p",
        numeroSessao: 7,
        objetivo: null,
        atividadesPrevistas: null,
        status: "planejada",
        sessaoId: null,
        fisioterapeutaId: null,
        fisioterapeutaNome: null,
        driveDocUrl: null,
        updatedAt: "",
      },
    ];
    expect(proximoNumeroSessao(itens)).toBe(8);
  });
});
