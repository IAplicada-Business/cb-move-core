import { describe, expect, it } from "vitest";

import { buildTemplatePreviewSections, isTemplateConteudoRascunho } from "./template-preview";

describe("template-preview", () => {
  it("detecta email_nf com corpo placeholder", () => {
    expect(
      isTemplateConteudoRascunho("email_nf", {
        assunto: "NF {{paciente}}",
        corpo: "placeholder",
      }),
    ).toBe(true);
  });

  it("monta preview de email com assunto e corpo", () => {
    const sections = buildTemplatePreviewSections({
      tipo: "email_nf",
      modelo: "particular",
      conteudo: {
        assunto: "CB MOVE NF {{numero}}",
        corpo_html: "<p>Olá {{destinatario_nome}}</p>",
        placeholders: ["numero", "destinatario_nome"],
      },
    });
    expect(sections.some((s) => s.title === "Assunto")).toBe(true);
    expect(sections.some((s) => s.body.includes("Olá"))).toBe(true);
  });

  it("monta preview de relatório com placeholders", () => {
    const sections = buildTemplatePreviewSections({
      tipo: "relatorio_atendimento",
      modelo: "convencional",
      conteudo: { placeholders: ["paciente_nome", "competencia"] },
    });
    expect(sections[0]?.body).toContain("paciente_nome");
  });
});
