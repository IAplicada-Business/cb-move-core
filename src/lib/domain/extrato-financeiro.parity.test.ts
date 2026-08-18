import { describe, expect, it } from "vitest";
import { EXTRATO_COLUNAS, EXTRATO_MASTER_COLUNAS_ESPERADAS } from "./extrato-financeiro";

/**
 * Fase 2b — gancho de paridade de colunas do extrato vs planilha master (Drive).
 * Quando houver xlsx real do cliente em scripts/drive_import/, estender este teste
 * para diff célula a célula por competência.
 */
describe("paridade extrato × master (colunas)", () => {
  it("exporta exatamente as colunas documentadas da master financeira", () => {
    expect([...EXTRATO_COLUNAS]).toEqual(EXTRATO_MASTER_COLUNAS_ESPERADAS);
    expect(EXTRATO_COLUNAS).toHaveLength(10);
    expect(EXTRATO_COLUNAS[0]).toBe("Nome do Paciente");
    expect(EXTRATO_COLUNAS[9]).toBe("SITUAÇÃO");
  });
});
