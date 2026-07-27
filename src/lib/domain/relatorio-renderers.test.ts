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

  it("unimed → docx-unimed-v1", () => {
    const r = selectRenderer("unimed", null, undefined, "convenio");
    expect(r.formato_arquivo).toBe("docx");
    expect(r.renderer).toBe("docx-unimed-v1");
  });

  it("puc → xlsx-puc-v1", () => {
    const r = selectRenderer("puc", null, undefined, "puc");
    expect(r.formato_arquivo).toBe("xlsx");
    expect(r.renderer).toBe("xlsx-puc-v1");
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

  it("template override renderer", () => {
    const r = selectRenderer("convencional", {
      renderer: "pdf-unimed-v1",
      output_format: "pdf",
    });
    expect(r.renderer).toBe("pdf-unimed-v1");
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

  it("usa placeholders legados do template", () => {
    expect(() =>
      validateRelatorioContext(
        "unimed",
        { paciente_nome: "João" },
        { placeholders: ["paciente_nome", "cid"] },
      ),
    ).toThrow(/cid/i);
  });
});
