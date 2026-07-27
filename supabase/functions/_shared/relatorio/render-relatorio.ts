import { gerarPdfGradeV2 } from "../pdf-grade-v2.ts";
import type {
  RelatorioRenderContext,
  RenderRelatorioDualResult,
  RenderRelatorioResult,
} from "./types.ts";
import type { RendererSelection } from "./types.ts";
import { gerarPdfLegado } from "./renderers/pdf-legado.ts";
import { gerarPdfUnimedV1 } from "./renderers/pdf-unimed-v1.ts";
import { gerarXlsxSharepointV1 } from "./renderers/xlsx-sharepoint-v1.ts";

async function renderPdfGradeV2(ctx: RelatorioRenderContext): Promise<Uint8Array> {
  return gerarPdfGradeV2({
    pacienteNome: ctx.pacienteNome,
    competenciaLabel: ctx.competenciaLabel,
    frequenciaTexto: ctx.frequenciaTexto,
    linhas: ctx.linhas,
    numSessoes: ctx.rodape.numSessoes,
    valorSessao: ctx.rodape.valorSessao,
    valorTotal: ctx.rodape.valorTotal,
    cargaHoraria: ctx.cargaHoraria,
    modelo: ctx.modelo === "sharepoint" ? "sharepoint" : ctx.modelo,
    tipoPaciente: ctx.tipoPaciente,
    camposExtras: ctx.camposExtras,
    regimeMensalista: ctx.regimeMensalista,
    valorUnitarioLabel: ctx.regimeMensalista ? "MENSAL" : "SESSÃO",
  });
}

/** PDF judicial (grade sharepoint) + XLSX SharePoint. */
export async function renderRelatorioDualJudicial(
  ctx: RelatorioRenderContext,
  selection: RendererSelection,
): Promise<RenderRelatorioDualResult> {
  const pdfCtx: RelatorioRenderContext = {
    ...ctx,
    modelo: "sharepoint",
    camposExtras: [
      { label: "Processo", valor: ctx.placeholders.processo },
      { label: "Fisioterapeuta", valor: ctx.placeholders.fisio_nome },
    ].filter((c) => c.valor?.trim()),
  };
  const [pdfBytes, xlsxBytes] = await Promise.all([
    renderPdfGradeV2(pdfCtx),
    Promise.resolve(gerarXlsxSharepointV1(ctx)),
  ]);
  return { pdfBytes, xlsxBytes, selection };
}

export async function renderRelatorio(
  ctx: RelatorioRenderContext,
  selection: RendererSelection,
): Promise<RenderRelatorioResult> {
  switch (selection.renderer) {
    case "dual-judicial-v1": {
      const dual = await renderRelatorioDualJudicial(ctx, selection);
      return { bytes: dual.pdfBytes, selection };
    }
    case "xlsx-sharepoint-v1":
      return {
        bytes: gerarXlsxSharepointV1(ctx),
        selection,
      };
    case "pdf-unimed-v1":
      return {
        bytes: await gerarPdfUnimedV1(ctx),
        selection,
      };
    case "pdf-legado":
      return {
        bytes: await gerarPdfLegado(ctx),
        selection,
      };
    case "pdf-grade-v2":
    default:
      return {
        bytes: await renderPdfGradeV2(ctx),
        selection: { ...selection, renderer: "pdf-grade-v2" },
      };
  }
}

export async function renderRelatorioWithDual(
  ctx: RelatorioRenderContext,
  selection: RendererSelection,
): Promise<RenderRelatorioResult | RenderRelatorioDualResult> {
  if (selection.renderer === "dual-judicial-v1") {
    return renderRelatorioDualJudicial(ctx, selection);
  }
  return renderRelatorio(ctx, selection);
}
