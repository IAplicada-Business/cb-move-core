import { describe, expect, it } from "vitest";
import {
  isJudicialDualOutput,
  selectRenderer,
  validateRelatorioContext,
} from "./relatorio-renderers";

describe("isJudicialDualOutput", () => {
  it("judicial gera dual", () => {
    expect(isJudicialDualOutput("judicial", undefined)).toBe(true);
  });
  it("legado não gera dual", () => {
    expect(isJudicialDualOutput("judicial", "legado")).toBe(false);
  });
});

describe("selectRenderer", () => {
  it("tipo judicial → dual", () => {
    const r = selectRenderer("puc", null, undefined, "judicial");
    expect(r.formato_arquivo).toBe("dual");
    expect(r.renderer).toBe("dual-judicial-v1");
  });

  it("sharepoint modelo → dual", () => {
    const r = selectRenderer("sharepoint", null);
    expect(r.formato_arquivo).toBe("dual");
  });

  it("unimed → pdf-unimed-v1", () => {
    const r = selectRenderer("unimed", null, undefined, "convenio");
    expect(r.formato_arquivo).toBe("pdf");
    expect(r.renderer).toBe("pdf-unimed-v1");
  });

  it("convencional → pdf-grade-v2", () => {
    const r = selectRenderer("convencional", null);
    expect(r.renderer).toBe("pdf-grade-v2");
  });

  it("legado override", () => {
    const r = selectRenderer("sharepoint", null, "legado", "judicial");
    expect(r.renderer).toBe("pdf-legado");
    expect(r.modelo_pdf).toBe("legado");
  });
});

describe("validateRelatorioContext", () => {
  it("exige processo para sharepoint", () => {
    expect(() => validateRelatorioContext("sharepoint", { paciente_nome: "João" })).toThrow(
      /processo/i,
    );
  });

  it("ok com processo", () => {
    expect(() =>
      validateRelatorioContext("sharepoint", {
        paciente_nome: "João",
        processo: "0001234",
      }),
    ).not.toThrow();
  });
});
