import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "https://esm.sh/pdf-lib@1.17.1";
import type { RelatorioAtendimentoLinha } from "./relatorio-atendimento-linhas.ts";
import { formatDataRelatorio, formatMoedaBr } from "./relatorio-atendimento-linhas.ts";

const INK = rgb(0.173, 0.173, 0.173);
const GRAY = rgb(0.42, 0.42, 0.45);
const LINE = rgb(0.75, 0.75, 0.75);

const COLS = [
  { label: "DATA", width: 58 },
  { label: "CARGA\nHORÁRIA", width: 52 },
  { label: "FISIOTERAPEUTA", width: 110 },
  { label: "ASSINATURA", width: 78 },
  { label: "CARIMBO", width: 78 },
  { label: "PACIENTE", width: 78 },
];

const TABLE_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

type PdfGradeParams = {
  pacienteNome: string;
  competenciaLabel: string;
  frequenciaTexto: string;
  linhas: RelatorioAtendimentoLinha[];
  numSessoes: number;
  valorSessao: number;
  valorTotal: number;
  cargaHoraria: string;
};

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export async function gerarPdfGradeV2(params: PdfGradeParams): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const footerHeight = 130;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (
    p: PDFPage,
    text: string,
    x: number,
    yPos: number,
    size: number,
    f: PDFFont,
    color = INK,
  ) => {
    p.drawText(text, { x, y: yPos, size, font: f, color });
  };

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    drawTableHeader(page, y, fontBold);
    y -= 28;
  };

  drawText(page, "RELATÓRIO DE ATENDIMENTOS", margin + 120, y, 14, fontBold);
  drawText(page, "CB MOVE", pageWidth - margin - 70, y, 10, fontBold);
  drawText(page, "Neuroscience", pageWidth - margin - 70, y - 11, 7, font);
  y -= 28;
  drawText(page, `NOME DO PACIENTE: ${truncate(params.pacienteNome, 55)}`, margin, y, 9, fontBold);
  y -= 14;
  drawText(page, `MÊS DE COMPETÊNCIA: ${params.competenciaLabel}`, margin, y, 9, fontBold);
  y -= 22;

  drawTableHeader(page, y, fontBold);
  y -= 28;

  const minY = margin + footerHeight;

  for (const linha of params.linhas) {
    if (y < minY) newPage();
    drawTableRow(page, margin, y, linha, font);
    y -= 20;
  }

  while (y > minY + 80) {
    drawEmptyRow(page, margin, y, font);
    y -= 20;
  }

  if (y < minY + footerHeight) newPage();
  y = minY + footerHeight - 10;

  const leftX = margin;
  const rightX = pageWidth / 2 + 10;

  drawText(page, "FISIOTERAPIA NEUROFUNCIONAL", leftX, y, 8, fontBold);
  y -= 12;
  drawText(page, `FREQUÊNCIA: ${params.frequenciaTexto}`, leftX, y, 8, font);
  y -= 12;
  drawText(page, `VALOR DA SESSÃO R$: ${formatMoedaBr(params.valorSessao)}`, leftX, y, 8, font);
  y -= 12;
  drawText(page, `NÚMERO DE SESSÕES: ${params.numSessoes}`, leftX, y, 8, font);
  drawText(page, `SESSÕES DE ${params.cargaHoraria} DE DURAÇÃO CADA.`, leftX, y - 10, 7, font);
  y -= 22;
  drawText(page, `VALOR TOTAL MENSAL R$: ${formatMoedaBr(params.valorTotal)}`, leftX, y, 9, fontBold);

  let yCharlene = minY + footerHeight - 10;
  page.drawLine({
    start: { x: rightX, y: yCharlene - 36 },
    end: { x: pageWidth - margin, y: yCharlene - 36 },
    thickness: 0.8,
    color: INK,
  });
  for (const line of [
    "DRA CHARLENE BRITO DE OLIVEIRA",
    "CREFITO 122334-F",
    "FISIOTERAPEUTA RESPONSÁVEL",
    "CB MOVE NEUROSCIENCE",
    "CNPJ 42.082.795/0001-74",
  ]) {
    yCharlene -= 10;
    drawText(page, line, rightX, yCharlene, 7, font, GRAY);
  }

  drawText(
    page,
    "CB MOVE NEUROSCIENCE LTDA - CNPJ: 42.082.795/0001-74 - CREFITO E-4651-RS",
    margin,
    margin - 6,
    6.5,
    font,
    GRAY,
  );

  return doc.save();
}

function drawTableHeader(p: PDFPage, topY: number, fontBold: PDFFont) {
  let x = 36;
  p.drawRectangle({ x, y: topY - 18, width: TABLE_WIDTH, height: 18, borderColor: LINE, borderWidth: 0.8 });
  for (const col of COLS) {
    const lines = col.label.split("\n");
    lines.forEach((line, i) => {
      p.drawText(line, { x: x + 2, y: topY - 12 - i * 8, size: 6.5, font: fontBold, color: INK });
    });
    x += col.width;
  }
}

function drawTableRow(
  p: PDFPage,
  startX: number,
  topY: number,
  linha: RelatorioAtendimentoLinha,
  font: PDFFont,
) {
  let x = startX;
  p.drawRectangle({ x, y: topY - 16, width: TABLE_WIDTH, height: 16, borderColor: LINE, borderWidth: 0.5 });
  const cells = [formatDataRelatorio(linha.data), linha.cargaHoraria, truncate(linha.fisioterapeutaNome, 22), "", "", ""];
  cells.forEach((cell, i) => {
    p.drawText(cell, { x: x + 2, y: topY - 12, size: 7, font, color: INK });
    x += COLS[i].width;
  });
}

function drawEmptyRow(p: PDFPage, startX: number, topY: number, font: PDFFont) {
  p.drawRectangle({ x: startX, y: topY - 16, width: TABLE_WIDTH, height: 16, borderColor: LINE, borderWidth: 0.5 });
}
