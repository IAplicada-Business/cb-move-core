import { describe, expect, it } from "vitest";

import {
  buildEmailTemplateVisualPreview,
  buildTemplatePreviewSections,
  isTemplateConteudoRascunho,
  substituirPlaceholdersTemplate,
} from "./template-preview";

describe("template-preview", () => {
  it("detecta email_nf com corpo placeholder", () => {
    expect(
      isTemplateConteudoRascunho("email_nf", {
        assunto: "NF {{paciente}}",
        corpo: "placeholder",
      }),
    ).toBe(true);
  });

  it("substitui placeholders no assunto e corpo", () => {
    const out = substituirPlaceholdersTemplate("NF {{numero}} — {{corpo_paciente_nome}}", {
      numero: "2085",
      corpo_paciente_nome: "Amanda Pavan",
    });
    expect(out).toBe("NF 2085 — Amanda Pavan");
  });

  it("monta preview visual de email com dados de exemplo", () => {
    const visual = buildEmailTemplateVisualPreview("judicial", {
      assunto: "CB MOVE NF {{numero}} — Proc. {{corpo_numero_processo}}",
      corpo_html: "<p>Olá <strong>{{destinatario_nome}}</strong></p>",
      placeholders: ["numero", "destinatario_nome"],
    });
    expect(visual?.assunto).toContain("5004821");
    expect(visual?.corpoHtml).toContain("Bradesco Seguros");
    expect(visual?.isRascunho).toBe(false);
  });

  it("seções técnicas não repetem o corpo renderizado", () => {
    const sections = buildTemplatePreviewSections({
      tipo: "email_nf",
      modelo: "particular",
      conteudo: {
        assunto: "CB MOVE NF {{numero}}",
        corpo_html: "<p>Olá</p>",
        placeholders: ["numero"],
      },
    });
    expect(sections.some((s) => s.title === "HTML (template)")).toBe(true);
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
