import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "https://esm.sh/docx@8.5.0";
import { formatDataRelatorio, formatMoedaBr } from "../../relatorio-atendimento-linhas.ts";
import type { RelatorioRenderContext } from "../types.ts";

function linha(texto: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: texto, bold, size: 22 })],
    spacing: { after: 100 },
  });
}

function celula(texto: string, bold = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold, size: 20 })] })],
  });
}

/** Layout Unimed institucional — DOCX editável (paridade Drive). */
export async function gerarDocxUnimedV1(ctx: RelatorioRenderContext): Promise<Uint8Array> {
  const blocos: Paragraph[] = [
    linha("Relatório de Atendimento — Unimed", true),
    linha("CB MOVE Neuroscience"),
    linha(""),
    linha(`Paciente: ${ctx.pacienteNome}`),
    linha(`Competência: ${ctx.competenciaLabel}`),
  ];

  if (ctx.placeholders.convenio_nome?.trim()) {
    blocos.push(linha(`Convênio: ${ctx.placeholders.convenio_nome}`));
  }
  if (ctx.placeholders.convenio_cnpj?.trim()) {
    blocos.push(linha(`CNPJ Convênio: ${ctx.placeholders.convenio_cnpj}`));
  }
  if (ctx.placeholders.cid?.trim()) {
    blocos.push(linha(`CID: ${ctx.placeholders.cid}`));
  }
  if (ctx.placeholders.fisio_nome?.trim()) {
    blocos.push(linha(`Fisioterapeuta: ${ctx.placeholders.fisio_nome}`));
  }

  blocos.push(linha(""));

  const headerRow = new TableRow({
    children: ["DATA", "CARGA HORÁRIA", "FISIOTERAPEUTA"].map((h) => celula(h, true)),
  });

  const dataRows =
    ctx.linhas.length === 0
      ? [new TableRow({ children: [celula("—"), celula(ctx.cargaHoraria), celula("—")] })]
      : ctx.linhas.map(
          (l) =>
            new TableRow({
              children: [
                celula(formatDataRelatorio(l.data)),
                celula(l.cargaHoraria),
                celula(l.fisioterapeutaNome),
              ],
            }),
        );

  const tabela = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  blocos.push(
    linha(`Frequência: ${ctx.frequenciaTexto}`),
    linha(`Número de sessões: ${ctx.rodape.numSessoes}`),
    linha(
      `${ctx.regimeMensalista ? "Valor mensal" : "Valor sessão"} R$: ${formatMoedaBr(ctx.rodape.valorSessao)}`,
    ),
    linha(`Valor total R$: ${formatMoedaBr(ctx.rodape.valorTotal)}`),
    linha(""),
    linha(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`),
  );

  if (ctx.template?.codigo) {
    blocos.push(linha(`Template: ${ctx.template.codigo}`));
  }

  const doc = new Document({
    sections: [{ children: [...blocos, tabela] }],
  });

  return new Uint8Array(await Packer.toBuffer(doc));
}
