import type {
  RelatorioAtendimentoLinha,
  RelatorioRodapeFinanceiro,
} from "../relatorio-atendimento-linhas.ts";

export type ModeloRelatorio = "convencional" | "unimed" | "sharepoint" | "puc";

export type FormatoArquivo = "pdf" | "xlsx" | "dual";

export type RendererKey =
  "pdf-grade-v2" | "pdf-unimed-v1" | "xlsx-sharepoint-v1" | "pdf-legado" | "dual-judicial-v1";

export type TemplateRelatorioConteudo = {
  renderer?: RendererKey;
  output_format?: FormatoArquivo;
  required_placeholders?: string[];
  codigo_rq?: string;
};

export type RelatorioRenderContext = {
  modelo: ModeloRelatorio;
  tipoPaciente: string;
  pacienteNome: string;
  competenciaLabel: string;
  competenciaMes: number;
  competenciaAno: number;
  frequenciaTexto: string;
  cargaHoraria: string;
  linhas: RelatorioAtendimentoLinha[];
  rodape: RelatorioRodapeFinanceiro;
  regimeMensalista: boolean;
  placeholders: Record<string, string>;
  camposExtras: { label: string; valor: string }[];
  evolucaoResumo: string;
  planoTerapeutico: string;
  template: { id: string; codigo?: string; conteudo: unknown } | null;
};

export type RendererSelection = {
  renderer: RendererKey;
  formato_arquivo: FormatoArquivo;
  contentType: string;
  modelo_pdf: "grade_v2" | "legado";
};

export type RenderRelatorioResult = {
  bytes: Uint8Array;
  selection: RendererSelection;
};

export type RenderRelatorioDualResult = {
  pdfBytes: Uint8Array;
  xlsxBytes: Uint8Array;
  selection: RendererSelection;
};
