/** Espelho de supabase/functions/_shared/relatorio/select-renderer.ts + validate-template.ts */
export type ModeloRelatorio = "convencional" | "unimed" | "sharepoint" | "puc";
export type FormatoArquivo = "pdf" | "xlsx" | "dual";
export type RendererKey =
  "pdf-grade-v2" | "pdf-unimed-v1" | "xlsx-sharepoint-v1" | "pdf-legado" | "dual-judicial-v1";

const DEFAULT_REQUIRED: Record<ModeloRelatorio, string[]> = {
  convencional: ["paciente_nome"],
  unimed: ["paciente_nome"],
  sharepoint: ["paciente_nome", "processo"],
  puc: ["paciente_nome"],
};

const MODEL_DEFAULTS: Record<ModeloRelatorio, { renderer: RendererKey; formato: FormatoArquivo }> =
  {
    convencional: { renderer: "pdf-grade-v2", formato: "pdf" },
    unimed: { renderer: "pdf-unimed-v1", formato: "pdf" },
    sharepoint: { renderer: "dual-judicial-v1", formato: "dual" },
    puc: { renderer: "pdf-grade-v2", formato: "pdf" },
  };

export function isJudicialDualOutput(
  tipoPaciente: string | null | undefined,
  modeloPdfBody?: string,
): boolean {
  return tipoPaciente === "judicial" && modeloPdfBody !== "legado";
}

export function validateRelatorioContext(
  modelo: ModeloRelatorio,
  placeholders: Record<string, string>,
  templateConteudo?: { required_placeholders?: string[] } | null,
): void {
  const required = templateConteudo?.required_placeholders?.length
    ? templateConteudo.required_placeholders
    : DEFAULT_REQUIRED[modelo];
  const missing = required.filter((key) => !placeholders[key]?.trim());
  if (missing.length === 0) return;
  throw new Error(`Relatório ${modelo}: campos faltando (${missing.join(", ")})`);
}

export function selectRenderer(
  modelo: ModeloRelatorio,
  templateConteudo?: { renderer?: RendererKey; output_format?: FormatoArquivo } | null,
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
  const defaults = MODEL_DEFAULTS[modelo] ?? MODEL_DEFAULTS.convencional;
  return {
    renderer: templateConteudo?.renderer ?? defaults.renderer,
    formato_arquivo: templateConteudo?.output_format ?? defaults.formato,
    modelo_pdf: "grade_v2" as const,
  };
}

export function relatorioArquivoLabel(formato: FormatoArquivo | null | undefined): string {
  if (formato === "dual") return "PDF + XLSX";
  if (formato === "xlsx") return "XLSX";
  return "PDF";
}

export function relatorioFormatoBadge(
  formato: FormatoArquivo | null | undefined,
  hasXlsx: boolean,
): string {
  if (formato === "dual" || (formato === "pdf" && hasXlsx)) return "PDF + XLSX";
  return relatorioArquivoLabel(formato);
}
