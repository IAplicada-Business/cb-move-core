import { describe, expect, it } from "vitest";
import {
  buildConsultaExperimentalEvolucao,
  CONSULTA_EXPERIMENTAL_SUBJETIVO,
  shouldSyncConsultaExperimentalProntuario,
} from "./consulta-experimental-prontuario";

describe("consulta-experimental-prontuario", () => {
  it("monta evolução SOAP com fisio e observações", () => {
    const ev = buildConsultaExperimentalEvolucao({
      data: "2026-06-15",
      fisioNome: "Camila Aguiar Pereira",
      observacoes: "Queixa de dor lombar. Iniciar avaliação postural.",
    });
    expect(ev.subjetivo).toBe(CONSULTA_EXPERIMENTAL_SUBJETIVO);
    expect(ev.objetivo).toContain("Camila Aguiar Pereira");
    expect(ev.objetivo).toContain("dor lombar");
    expect(ev.plano).toContain("periodização");
  });

  it("só sincroniza prontuário quando há data da consulta", () => {
    expect(
      shouldSyncConsultaExperimentalProntuario({
        consultaExperimentalEm: "2026-06-15",
        consultaExperimentalFisioId: null,
        consultaExperimentalObservacoes: null,
      }),
    ).toBe(true);
    expect(
      shouldSyncConsultaExperimentalProntuario({
        consultaExperimentalEm: null,
        consultaExperimentalFisioId: "x",
        consultaExperimentalObservacoes: "obs",
      }),
    ).toBe(false);
  });
});
