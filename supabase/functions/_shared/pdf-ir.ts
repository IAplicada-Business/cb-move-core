import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "https://esm.sh/pdf-lib@1.17.1";
import { BRAND, drawCbMoveDocumentFooter, drawCbMoveReportHeader } from "./pdf-brand.ts";

export type NotaIrLinha = {
  numero: string | null;
  emissao: string | null;
  destinatario_nome: string | null;
  status: string | null;
  valor: number;
};

export type RelatorioIrParams = {
  pacienteNome: string;
  pacienteCpf: string | null;
  ano: number;
  notas: NotaIrLinha[];
  total: number;
};

function formatMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = BRAND.ink,
) {
  page.drawText(text, { x, y, size, font, color });
}

/** PDF consolidado de NFs emitidas no ano — declaração de IR. */
export async function gerarPdfRelatorioIr(params: RelatorioIrParams): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const footerZone = margin + 36;
  const generatedAt = new Date().toLocaleDateString("pt-BR");

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = drawCbMoveReportHeader({
    page,
    pageWidth,
    pageHeight,
    margin,
    y: pageHeight - margin - 8,
    titulo: "Declaração de IR",
    subtitulo: `Exercício ${params.ano}`,
    tipoPaciente: "particular",
    font,
    fontBold,
  });

  drawText(page, "Paciente", margin, y, 8, font, BRAND.inkLight);
  drawText(page, truncate(params.pacienteNome || "—", 48), margin, y - 14, 12, fontBold);
  drawText(page, "CPF", pageWidth / 2, y, 8, font, BRAND.inkLight);
  drawText(page, params.pacienteCpf?.trim() || "—", pageWidth / 2, y - 14, 12, fontBold);
  y -= 36;

  drawText(page, "Ano-calendário", margin, y, 8, font, BRAND.inkLight);
  drawText(page, String(params.ano), margin, y - 14, 12, fontBold);
  drawText(page, "Total pago (NFs emitidas)", pageWidth / 2, y, 8, font, BRAND.inkLight);
  drawText(page, formatMoeda(params.total), pageWidth / 2, y - 14, 12, fontBold, BRAND.cyan700);
  y -= 34;

  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: pageWidth - margin * 2,
    height: 22,
    color: BRAND.line,
  });

  const cols = [
    { label: "Nº NF", x: margin + 6, width: 70 },
    { label: "Emissão", x: margin + 76, width: 70 },
    { label: "Destinatário", x: margin + 146, width: 220 },
    { label: "Status", x: margin + 366, width: 70 },
    { label: "Valor", x: margin + 436, width: 70 },
  ];

  for (const col of cols) {
    drawText(page, col.label, col.x, y + 2, 8, fontBold, BRAND.inkLight);
  }
  y -= 22;

  const ensureSpace = (needed: number) => {
    if (y - needed >= footerZone) return;
    drawCbMoveDocumentFooter({
      page,
      margin,
      pageWidth,
      font,
      fontBold,
      generatedAt,
      legalLine:
        "Documento para fins de declaração anual de Imposto de Renda · CB MOVE Neuroscience",
    });
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 8;
    drawText(page, `Declaração de IR · ${params.ano} (cont.)`, margin, y, 10, fontBold);
    y -= 24;
  };

  if (params.notas.length === 0) {
    ensureSpace(24);
    drawText(page, "Nenhuma nota fiscal emitida neste ano.", margin, y, 10, font, BRAND.inkLight);
    y -= 20;
  } else {
    for (const nf of params.notas) {
      ensureSpace(18);
      drawText(page, truncate(nf.numero || "—", 12), cols[0].x, y, 9, font);
      drawText(page, formatData(nf.emissao), cols[1].x, y, 9, font);
      drawText(page, truncate(nf.destinatario_nome || "—", 34), cols[2].x, y, 9, font);
      drawText(page, truncate(nf.status || "—", 12), cols[3].x, y, 9, font);
      const valor = formatMoeda(nf.valor);
      const valorW = font.widthOfTextAtSize(valor, 9);
      drawText(page, valor, cols[4].x + cols[4].width - valorW - 4, y, 9, fontBold);
      y -= 16;
      page.drawLine({
        start: { x: margin, y: y + 8 },
        end: { x: pageWidth - margin, y: y + 8 },
        thickness: 0.4,
        color: BRAND.line,
      });
    }
  }

  ensureSpace(40);
  y -= 8;
  drawText(page, "Total", margin, y, 10, fontBold);
  const totalLabel = formatMoeda(params.total);
  const totalW = fontBold.widthOfTextAtSize(totalLabel, 11);
  drawText(page, totalLabel, pageWidth - margin - totalW, y, 11, fontBold, BRAND.cyan700);
  y -= 28;

  drawText(
    page,
    "Este documento consolida as notas fiscais emitidas pela CB MOVE Neuroscience",
    margin,
    y,
    8,
    font,
    BRAND.inkLight,
  );
  y -= 11;
  drawText(
    page,
    "referentes ao paciente acima, para uso na declaração anual de Imposto de Renda.",
    margin,
    y,
    8,
    font,
    BRAND.inkLight,
  );

  drawCbMoveDocumentFooter({
    page,
    margin,
    pageWidth,
    font,
    fontBold,
    generatedAt,
    legalLine: "Documento para fins de declaração anual de Imposto de Renda · CB MOVE Neuroscience",
  });

  return doc.save();
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
