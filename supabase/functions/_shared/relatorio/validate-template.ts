import type { ModeloRelatorio, TemplateRelatorioConteudo } from "./types.ts";

const DEFAULT_REQUIRED: Record<ModeloRelatorio, string[]> = {
  convencional: ["paciente_nome"],
  unimed: ["paciente_nome"],
  sharepoint: ["paciente_nome", "processo"],
  puc: ["paciente_nome"],
};

function parseTemplateConteudo(conteudo: unknown): TemplateRelatorioConteudo {
  if (!conteudo || typeof conteudo !== "object") return {};
  return conteudo as TemplateRelatorioConteudo;
}

export function requiredPlaceholdersForModelo(
  modelo: ModeloRelatorio,
  templateConteudo: unknown,
): string[] {
  const parsed = parseTemplateConteudo(templateConteudo);
  if (parsed.required_placeholders?.length) return parsed.required_placeholders;
  return DEFAULT_REQUIRED[modelo] ?? ["paciente_nome"];
}

export function validateRelatorioContext(
  modelo: ModeloRelatorio,
  placeholders: Record<string, string>,
  templateConteudo: unknown,
): void {
  const required = requiredPlaceholdersForModelo(modelo, templateConteudo);
  const missing = required.filter((key) => !placeholders[key]?.trim());
  if (missing.length === 0) return;

  const labels: Record<string, string> = {
    paciente_nome: "nome do paciente",
    processo: "número do processo (cadastro judicial)",
    cid: "CID",
    sessoes: "sessões no período",
    fisio: "fisioterapeuta",
  };
  const human = missing.map((k) => labels[k] ?? k).join(", ");
  throw new Error(`Relatório ${modelo}: preencha ${human} antes de gerar.`);
}
