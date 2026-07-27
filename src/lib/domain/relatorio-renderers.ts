/** Espelho de supabase/functions/_shared/relatorio/select-renderer.ts + validate-template.ts */
export type ModeloRelatorio = "convencional" | "unimed" | "sharepoint" | "puc";
export type FormatoArquivo = "pdf" | "xlsx" | "dual" | "docx";
export type RendererKey =
  | "pdf-grade-v2"
  | "pdf-unimed-v1"
  | "docx-unimed-v1"
  | "xlsx-sharepoint-v1"
  | "xlsx-puc-v1"
  | "pdf-legado"
  | "dual-judicial-v1";

const DEFAULT_REQUIRED: Record<ModeloRelatorio, string[]> = {
  convencional: ["paciente_nome"],
  unimed: ["paciente_nome"],
  sharepoint: ["paciente_nome", "processo"],
  puc: ["paciente_nome"],
};

const MODEL_DEFAULTS: Record<ModeloRelatorio, { renderer: RendererKey; formato: FormatoArquivo }> =
  {
    convencional: { renderer: "pdf-grade-v2", formato: "pdf" },
    unimed: { renderer: "docx-unimed-v1", formato: "docx" },
    sharepoint: { renderer: "dual-judicial-v1", formato: "dual" },
    puc: { renderer: "xlsx-puc-v1", formato: "xlsx" },
  };

export function isJudicialDualOutput(
  tipoPaciente: string | null | undefined,
  modeloPdfBody?: string,
): boolean {
  return tipoPaciente === "judicial" && modeloPdfBody !== "legado";
}

function parseTemplateConteudo(
  templateConteudo?: {
    renderer?: RendererKey;
    output_format?: FormatoArquivo;
    required_placeholders?: string[];
    placeholders?: string[];
  } | null,
) {
  return templateConteudo ?? {};
}

export function requiredPlaceholdersForModelo(
  modelo: ModeloRelatorio,
  templateConteudo?: { required_placeholders?: string[]; placeholders?: string[] } | null,
): string[] {
  const parsed = parseTemplateConteudo(templateConteudo);
  if (parsed.required_placeholders?.length) return parsed.required_placeholders;
  if (parsed.placeholders?.length) return parsed.placeholders;
  return DEFAULT_REQUIRED[modelo];
}

export function validateRelatorioContext(
  modelo: ModeloRelatorio,
  placeholders: Record<string, string>,
  templateConteudo?: { required_placeholders?: string[]; placeholders?: string[] } | null,
): void {
  const required = requiredPlaceholdersForModelo(modelo, templateConteudo);
  const missing = required.filter((key) => !placeholders[key]?.trim());
  if (missing.length === 0) return;
  throw new Error(`Relatório ${modelo}: campos faltando (${missing.join(", ")})`);
}

export function selectRenderer(
  modelo: ModeloRelatorio,
  templateConteudo?: {
    renderer?: RendererKey;
    output_format?: FormatoArquivo;
    required_placeholders?: string[];
    placeholders?: string[];
  } | null,
  modeloPdfBody?: string,
  tipoPaciente?: string | null,
) {
  if (modeloPdfBody === "legado") {
    return {
      renderer: "pdf-legado" as const,
      formato_arquivo: "pdf" as const,
      modelo_pdf: "legado" as const,
    };
  }
  if (isJudicialDualOutput(tipoPaciente, modeloPdfBody)) {
    return {
      renderer: "dual-judicial-v1" as const,
      formato_arquivo: "dual" as const,
      modelo_pdf: "grade_v2" as const,
    };
  }
  const parsed = parseTemplateConteudo(templateConteudo);
  const defaults = MODEL_DEFAULTS[modelo] ?? MODEL_DEFAULTS.convencional;
  return {
    renderer: parsed.renderer ?? defaults.renderer,
    formato_arquivo: parsed.output_format ?? defaults.formato,
    modelo_pdf: "grade_v2" as const,
  };
}

export function relatorioArquivoLabel(formato: FormatoArquivo | null | undefined): string {
  if (formato === "dual") return "PDF + XLSX";
  if (formato === "xlsx") return "XLSX";
  if (formato === "docx") return "DOCX";
  return "PDF";
}

export function relatorioFormatoBadge(
  formato: FormatoArquivo | null | undefined,
  hasXlsx: boolean,
): string {
  if (formato === "dual" || (formato === "pdf" && hasXlsx)) return "PDF + XLSX";
  return relatorioArquivoLabel(formato);
}

export function relatorioArquivoUrlLabel(
  url: string | null | undefined,
  formato: FormatoArquivo | null | undefined,
): string {
  if (formato === "docx" || url?.toLowerCase().endsWith(".docx")) return "DOCX";
  if (formato === "xlsx" || url?.toLowerCase().endsWith(".xlsx")) return "XLSX";
  return "PDF";
}
