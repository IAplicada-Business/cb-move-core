import type {
  FormatoArquivo,
  ModeloRelatorio,
  RendererKey,
  RendererSelection,
  TemplateRelatorioConteudo,
} from "./types.ts";

function parseTemplateConteudo(conteudo: unknown): TemplateRelatorioConteudo {
  if (!conteudo || typeof conteudo !== "object") return {};
  return conteudo as TemplateRelatorioConteudo;
}

const MODEL_DEFAULTS: Record<
  ModeloRelatorio,
  { renderer: RendererKey; formato: FormatoArquivo; contentType: string }
> = {
  convencional: {
    renderer: "pdf-grade-v2",
    formato: "pdf",
    contentType: "application/pdf",
  },
  unimed: {
    renderer: "pdf-unimed-v1",
    formato: "pdf",
    contentType: "application/pdf",
  },
  sharepoint: {
    renderer: "dual-judicial-v1",
    formato: "dual",
    contentType: "application/pdf",
  },
  puc: {
    renderer: "pdf-grade-v2",
    formato: "pdf",
    contentType: "application/pdf",
  },
};

/** Pacientes judiciais recebem PDF (grade) + XLSX SharePoint na mesma geração. */
export function isJudicialDualOutput(
  tipoPaciente: string | null | undefined,
  modeloPdfBody: string | undefined,
): boolean {
  return tipoPaciente === "judicial" && modeloPdfBody !== "legado";
}

export function selectRenderer(
  modelo: ModeloRelatorio,
  templateConteudo: unknown,
  modeloPdfBody: string | undefined,
  tipoPaciente?: string | null,
): RendererSelection {
  if (modeloPdfBody === "legado") {
    return {
      renderer: "pdf-legado",
      formato_arquivo: "pdf",
      contentType: "application/pdf",
      modelo_pdf: "legado",
    };
  }

  if (isJudicialDualOutput(tipoPaciente, modeloPdfBody)) {
    return {
      renderer: "dual-judicial-v1",
      formato_arquivo: "dual",
      contentType: "application/pdf",
      modelo_pdf: "grade_v2",
    };
  }

  const parsed = parseTemplateConteudo(templateConteudo);
  const defaults = MODEL_DEFAULTS[modelo] ?? MODEL_DEFAULTS.convencional;
  const renderer = parsed.renderer ?? defaults.renderer;
  const formato = parsed.output_format ?? defaults.formato;
  const contentType =
    formato === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf";

  return {
    renderer,
    formato_arquivo: formato,
    contentType,
    modelo_pdf: "grade_v2",
  };
}
