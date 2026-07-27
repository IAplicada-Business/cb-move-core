import { describe, expect, it } from "vitest";

import {
  filterPacientesRelatorioLote,
  mensagemEscopoRelatorioLote,
  podeGerarLoteRelatorio,
} from "./relatorio-lote";

const pacientes = [
  { id: "1", nome: "Ana", convenioId: "c1" },
  { id: "2", nome: "Bruno", convenioId: "c1" },
  { id: "3", nome: "Carla", convenioId: "c2" },
  { id: "4", nome: "Diego", convenioId: null },
];

describe("relatorio-lote", () => {
  it("convênio sem ID selecionado retorna lista vazia", () => {
    expect(filterPacientesRelatorioLote(pacientes, "convenio", "")).toEqual([]);
  });

  it("convênio com ID filtra só pacientes daquele convênio", () => {
    expect(filterPacientesRelatorioLote(pacientes, "convenio", "c1")).toEqual([
      pacientes[0],
      pacientes[1],
    ]);
  });

  it("particular retorna todos os pacientes do tipo (já filtrados upstream)", () => {
    const particulares = pacientes.slice(0, 2);
    expect(filterPacientesRelatorioLote(particulares, "particular", "")).toEqual(particulares);
  });

  it("podeGerarLote exige convênio selecionado para tipo convenio", () => {
    expect(podeGerarLoteRelatorio([pacientes[0]], "convenio", "")).toBe(false);
    expect(podeGerarLoteRelatorio([pacientes[0]], "convenio", "c1")).toBe(true);
    expect(podeGerarLoteRelatorio([], "judicial", "")).toBe(false);
    expect(podeGerarLoteRelatorio([pacientes[0]], "judicial", "")).toBe(true);
  });

  it("mensagemEscopo orienta seleção de convênio antes do lote", () => {
    expect(
      mensagemEscopoRelatorioLote({
        isLoading: false,
        tipo: "convenio",
        convenioId: "",
        count: pacientes.length,
        tipoLabel: "Convênio",
      }),
    ).toBe("Selecione um convênio para ver os pacientes e gerar em lote.");
  });
});
