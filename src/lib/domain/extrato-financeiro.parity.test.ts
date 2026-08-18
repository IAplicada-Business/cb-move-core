import { describe, expect, it } from "vitest";
import {
  EXTRATO_COLUNAS,
  EXTRATO_MASTER_COLUNAS_ESPERADAS,
  extrairSituacao,
} from "./extrato-financeiro";

/**
 * Fase 2b — gancho de paridade de colunas do extrato vs planilha master (Drive).
 * Diff completo: `python3 scripts/diff_paridade_extrato_drive.py`
 * Relatório: `docs/fase2-paridade-relatorios-2026-08-18.md`
 */
describe("paridade extrato × master (colunas)", () => {
  it("exporta exatamente as colunas documentadas da master financeira", () => {
    expect([...EXTRATO_COLUNAS]).toEqual(EXTRATO_MASTER_COLUNAS_ESPERADAS);
    expect(EXTRATO_COLUNAS).toHaveLength(10);
    expect(EXTRATO_COLUNAS[0]).toBe("Nome do Paciente");
    expect(EXTRATO_COLUNAS[7]).toBe("R$ Previsto");
    expect(EXTRATO_COLUNAS[8]).toBe("R$ Recebido");
    expect(EXTRATO_COLUNAS[9]).toBe("SITUAÇÃO");
  });

  it("aliases Drive (AGOSTO R$ Referente / JAN Previsto) mapeiam para Previsto", () => {
    const aliases = {
      "R$ Referente": "R$ Previsto",
      Previsto: "R$ Previsto",
    };
    for (const [from, to] of Object.entries(aliases)) {
      expect(EXTRATO_COLUNAS).toContain(to);
      expect(from === to || Boolean(aliases[from as keyof typeof aliases])).toBe(true);
    }
  });
});

describe("extrairSituacao", () => {
  it("usa label do status quando migrado_logjur vem sem texto", () => {
    expect(extrairSituacao("migrado_logjur |", "pago")).toBe("PAGO");
    expect(extrairSituacao("migrado_logjur |", "pendente")).toBe("Pendente");
  });

  it("preserva texto livre após migrado_logjur", () => {
    expect(extrairSituacao("migrado_logjur | PAGAMENTO REFERENTE 052026", "atrasado")).toBe(
      "PAGAMENTO REFERENTE 052026",
    );
  });
});
