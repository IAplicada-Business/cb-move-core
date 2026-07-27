import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "https://esm.sh/pdf-lib@1.17.1";
import type { RelatorioAtendimentoLinha } from "./relatorio-atendimento-linhas.ts";
import { formatDataRelatorio, formatMoedaBr } from "./relatorio-atendimento-linhas.ts";
import { BRAND, drawCbMoveDocumentFooter, drawCbMoveReportHeader } from "./pdf-brand.ts";

const COLS = [
  { label: "DATA", width: 58 },
  { label: "CARGA\nHORÁRIA", width: 52 },
  { label: "FISIOTERAPEUTA", width: 110 },
  { label: "ASSINATURA", width: 78 },
  { label: "CARIMBO", width: 78 },
  { label: "PACIENTE", width: 78 },
];

const TABLE_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

const MODELO_TITULO: Record<string, string> = {
  convencional: "Relatório de Atendimento",
  unimed: "Relatório de Atendimento — Unimed",
  sharepoint: "Relatório de Atendimento — Judicial",
  puc: "Relatório de Atendimento — PUC",
};

type PdfGradeParams = {
  pacienteNome: string;
  competenciaLabel: string;
  frequenciaTexto: string;
  linhas: RelatorioAtendimentoLinha[];
  numSessoes: number;
  valorSessao: number;
  valorTotal: number;
  cargaHoraria: string;
  modelo?: string;
  tipoPaciente?: string;
  camposExtras?: { label: string; valor: string }[];
  valorUnitarioLabel?: string;
  regimeMensalista?: boolean;
};

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatGeneratedAt(): string {
  return new Date().toLocaleDateString("pt-BR");
}

export async function gerarPdfGradeV2(params: PdfGradeParams): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const footerHeight = 128;
  const footerZoneTop = margin + footerHeight;
  const titulo = MODELO_TITULO[params.modelo ?? "convencional"] ?? MODELO_TITULO.convencional;
  const valorLabel = params.valorUnitarioLabel ?? (params.regimeMensalista ? "MENSAL" : "SESSÃO");
  const generatedAt = formatGeneratedAt();

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = drawPageHeader(page, params, titulo, margin, pageWidth, pageHeight, font, fontBold);

  const drawText = (
    p: PDFPage,
    text: string,
    x: number,
    yPos: number,
    size: number,
    f: PDFFont,
    color = BRAND.ink,
  ) => {
    p.drawText(text, { x, y: yPos, size, font: f, color });
  };

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 8;
    drawTableHeader(page, y, fontBold, margin);
    y -= 28;
  };

  drawTableHeader(page, y, fontBold, margin);
  y -= 28;

  for (const linha of params.linhas) {
    if (y < footerZoneTop + 24) newPage();
    drawTableRow(page, margin, y, linha, font);
    y -= 20;
  }

  const minEmptyRows = params.linhas.length === 0 ? 8 : 3;
  let emptyRows = 0;
  while (y > footerZoneTop + 24 && emptyRows < minEmptyRows) {
    drawEmptyRow(page, margin, y, font);
    y -= 20;
    emptyRows++;
  }

  drawFinancialFooter(
    page,
    margin,
    pageWidth,
    footerZoneTop,
    params,
    valorLabel,
    font,
    fontBold,
    drawText,
  );
  drawCbMoveDocumentFooter({
    page,
    margin,
    pageWidth,
    font,
    fontBold,
    generatedAt,
  });

  return doc.save();
}

function drawPageHeader(
  page: PDFPage,
  params: PdfGradeParams,
  titulo: string,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  font: PDFFont,
  fontBold: PDFFont,
): number {
  let y = pageHeight - margin;

  y = drawCbMoveReportHeader({
    page,
    pageWidth,
    pageHeight,
    margin,
    y,
    titulo,
    subtitulo: "Relatório de Atendimento · CB MOVE Neuroscience",
    tipoPaciente: params.tipoPaciente ?? "particular",
    font,
    fontBold,
  });

  page.drawText(`Paciente: ${truncate(params.pacienteNome, 58)}`, {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: BRAND.ink,
  });
  y -= 14;
  page.drawText(`Competência: ${params.competenciaLabel}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: BRAND.inkLight,
  });
  y -= 12;

  for (const campo of params.camposExtras ?? []) {
    if (!campo.valor?.trim()) continue;
    page.drawText(`${campo.label}: ${truncate(campo.valor, 62)}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: BRAND.inkLight,
    });
    y -= 12;
  }

  y -= 8;
  return y;
}

function drawFinancialFooter(
  page: PDFPage,
  margin: number,
  pageWidth: number,
  footerZoneTop: number,
  params: PdfGradeParams,
  valorLabel: string,
  font: PDFFont,
  fontBold: PDFFont,
  drawText: (
    p: PDFPage,
    text: string,
    x: number,
    yPos: number,
    size: number,
    f: PDFFont,
    color?: ReturnType<typeof rgb>,
  ) => void,
) {
  const leftX = margin;
  const rightX = pageWidth / 2 + 8;
  const blockTop = footerZoneTop + 96;

  page.drawLine({
    start: { x: margin, y: blockTop + 4 },
    end: { x: pageWidth - margin, y: blockTop + 4 },
    thickness: 0.6,
    color: BRAND.line,
  });

  let y = blockTop - 8;
  drawText(page, "FISIOTERAPIA NEUROFUNCIONAL", leftX, y, 8, fontBold);
  y -= 12;
  drawText(page, `FREQUÊNCIA: ${params.frequenciaTexto}`, leftX, y, 8, font);
  y -= 12;
  drawText(
    page,
    `VALOR DA ${valorLabel} R$: ${formatMoedaBr(params.valorSessao)}`,
    leftX,
    y,
    8,
    font,
  );
  y -= 12;
  drawText(page, `NÚMERO DE SESSÕES: ${params.numSessoes}`, leftX, y, 8, font);
  drawText(page, `SESSÕES DE ${params.cargaHoraria} DE DURAÇÃO CADA.`, leftX, y - 10, 7, font);
  y -= 22;
  drawText(
    page,
    `VALOR TOTAL MENSAL R$: ${formatMoedaBr(params.valorTotal)}`,
    leftX,
    y,
    9,
    fontBold,
  );

  let ySig = blockTop - 8;
  page.drawLine({
    start: { x: rightX, y: ySig - 38 },
    end: { x: pageWidth - margin, y: ySig - 38 },
    thickness: 0.8,
    color: BRAND.ink,
  });
  for (const line of [
    "DRA CHARLENE BRITO DE OLIVEIRA",
    "CREFITO 122334-F",
    "FISIOTERAPEUTA RESPONSÁVEL",
    "CB MOVE NEUROSCIENCE",
    "CNPJ 42.082.795/0001-74",
  ]) {
    ySig -= 10;
    drawText(page, line, rightX, ySig, 7, font, BRAND.inkLight);
  }
}

function drawTableHeader(p: PDFPage, topY: number, fontBold: PDFFont, margin: number) {
  let x = margin;
  p.drawRectangle({
    x,
    y: topY - 18,
    width: TABLE_WIDTH,
    height: 18,
    color: rgb(0.937, 0.976, 0.98),
    borderColor: BRAND.line,
    borderWidth: 0.8,
  });
  for (const col of COLS) {
    const lines = col.label.split("\n");
    lines.forEach((line, i) => {
      p.drawText(line, {
        x: x + 2,
        y: topY - 12 - i * 8,
        size: 6.5,
        font: fontBold,
        color: BRAND.ink,
      });
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
  p.drawRectangle({
    x,
    y: topY - 16,
    width: TABLE_WIDTH,
    height: 16,
    borderColor: BRAND.line,
    borderWidth: 0.5,
  });
  const cells = [
    formatDataRelatorio(linha.data),
    linha.cargaHoraria,
    truncate(linha.fisioterapeutaNome, 22),
    "",
    "",
    "",
  ];
  cells.forEach((cell, i) => {
    p.drawText(cell, { x: x + 2, y: topY - 12, size: 7, font, color: BRAND.ink });
    x += COLS[i].width;
  });
}

function drawEmptyRow(p: PDFPage, startX: number, topY: number, _font: PDFFont) {
  p.drawRectangle({
    x: startX,
    y: topY - 16,
    width: TABLE_WIDTH,
    height: 16,
    borderColor: BRAND.line,
    borderWidth: 0.5,
  });
}
