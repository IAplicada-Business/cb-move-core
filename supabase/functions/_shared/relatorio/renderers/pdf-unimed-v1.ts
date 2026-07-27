import { gerarPdfGradeV2 } from "../../pdf-grade-v2.ts";
import type { RelatorioRenderContext } from "../types.ts";

/**
 * Layout Unimed — grade_v2 com bloco institucional (convênio, CID, CNPJ).
 * Campos extras já vêm montados no contexto quando modelo = unimed.
 */
export async function gerarPdfUnimedV1(ctx: RelatorioRenderContext): Promise<Uint8Array> {
  const extras = [...ctx.camposExtras];
  if (ctx.placeholders.convenio_cnpj?.trim()) {
    const hasCnpj = extras.some((e) => /cnpj/i.test(e.label));
    if (!hasCnpj) {
      extras.push({ label: "CNPJ Convênio", valor: ctx.placeholders.convenio_cnpj });
    }
  }
  if (ctx.placeholders.cid?.trim()) {
    const hasCid = extras.some((e) => /cid/i.test(e.label));
    if (!hasCid) {
      extras.unshift({ label: "CID", valor: ctx.placeholders.cid });
    }
  }

  return gerarPdfGradeV2({
    pacienteNome: ctx.pacienteNome,
    competenciaLabel: ctx.competenciaLabel,
    frequenciaTexto: ctx.frequenciaTexto,
    linhas: ctx.linhas,
    numSessoes: ctx.rodape.numSessoes,
    valorSessao: ctx.rodape.valorSessao,
    valorTotal: ctx.rodape.valorTotal,
    cargaHoraria: ctx.cargaHoraria,
    modelo: "unimed",
    tipoPaciente: ctx.tipoPaciente,
    camposExtras: extras,
    regimeMensalista: ctx.regimeMensalista,
    valorUnitarioLabel: ctx.regimeMensalista ? "MENSAL" : "SESSÃO",
  });
}
