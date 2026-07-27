import { rgb, type PDFPage, type PDFFont } from "https://esm.sh/pdf-lib@1.17.1";

/** Paleta oficial CB MOVE (design system / relatório financeiro). */
export const BRAND = {
  ink: rgb(0.173, 0.173, 0.173),
  inkLight: rgb(0.42, 0.42, 0.45),
  paper: rgb(1, 1, 1),
  line: rgb(0.886, 0.898, 0.91),
  cyan700: rgb(0.176, 0.514, 0.533),
  cyan600: rgb(0.247, 0.71, 0.737),
  magenta: rgb(0.851, 0.275, 0.627),
  orange: rgb(0.961, 0.541, 0.122),
  lime: rgb(0.773, 0.851, 0.196),
  purple: rgb(0.482, 0.31, 0.71),
};

export const TIPO_ACCENT: Record<string, { label: string; color: ReturnType<typeof rgb> }> = {
  particular: { label: "Particular", color: BRAND.cyan700 },
  judicial: { label: "Judicial", color: BRAND.magenta },
  convenio: { label: "Convênio", color: BRAND.purple },
  puc: { label: "PUC", color: BRAND.orange },
};

const RING_SEGMENTS = [
  { color: BRAND.magenta, start: 130, end: 202 },
  { color: BRAND.orange, start: 202, end: 274 },
  { color: BRAND.lime, start: 274, end: 346 },
  { color: BRAND.cyan600, start: 346, end: 418 },
  { color: BRAND.purple, start: 418, end: 490 },
];

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function drawBrandRing(page: PDFPage, cx: number, cy: number, r: number, thickness: number) {
  const stepsPerSegment = 10;
  for (const seg of RING_SEGMENTS) {
    for (let i = 0; i < stepsPerSegment; i++) {
      const a0 = seg.start + ((seg.end - seg.start) * i) / stepsPerSegment;
      const a1 = seg.start + ((seg.end - seg.start) * (i + 1)) / stepsPerSegment;
      page.drawLine({
        start: polarPoint(cx, cy, r, a0),
        end: polarPoint(cx, cy, r, a1),
        thickness,
        color: seg.color,
      });
    }
  }
}

export function drawRainbowStrip(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const colors = [BRAND.magenta, BRAND.orange, BRAND.lime, BRAND.cyan600, BRAND.purple];
  const segWidth = width / colors.length;
  colors.forEach((color, i) => {
    page.drawRectangle({ x: x + i * segWidth, y, width: segWidth, height, color });
  });
}

type ReportHeaderOpts = {
  page: PDFPage;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  y: number;
  titulo: string;
  subtitulo?: string;
  tipoPaciente?: string;
  font: PDFFont;
  fontBold: PDFFont;
};

/** Cabeçalho padrão CB MOVE (anel + faixa arco-íris + selo do tipo). Retorna novo Y. */
export function drawCbMoveReportHeader(opts: ReportHeaderOpts): number {
  const { page, pageWidth, pageHeight, margin, font, fontBold } = opts;
  let y = opts.y;
  const tipoInfo = TIPO_ACCENT[opts.tipoPaciente ?? "particular"] ?? TIPO_ACCENT.particular;

  drawRainbowStrip(page, 0, pageHeight - 3, pageWidth, 3);

  const ringR = 9;
  const ringCx = margin + ringR;
  const ringCy = y - ringR;
  drawBrandRing(page, ringCx, ringCy, ringR, 2.2);
  page.drawEllipse({ x: ringCx, y: ringCy, xScale: 5, yScale: 5, color: BRAND.paper });

  page.drawText("CB MOVE", {
    x: margin + ringR * 2 + 8,
    y: y - 4,
    size: 13,
    font: fontBold,
    color: BRAND.ink,
  });
  page.drawText("NEUROSCIENCE", {
    x: margin + ringR * 2 + 8,
    y: y - 15,
    size: 6.5,
    font,
    color: BRAND.inkLight,
  });

  const tituloSize = 11;
  const tituloWidth = fontBold.widthOfTextAtSize(opts.titulo, tituloSize);
  page.drawText(opts.titulo, {
    x: pageWidth - margin - tituloWidth,
    y: y - 4,
    size: tituloSize,
    font: fontBold,
    color: BRAND.ink,
  });

  if (opts.subtitulo) {
    const subSize = 7.5;
    const subWidth = font.widthOfTextAtSize(opts.subtitulo, subSize);
    page.drawText(opts.subtitulo, {
      x: pageWidth - margin - subWidth,
      y: y - 14,
      size: subSize,
      font,
      color: BRAND.inkLight,
    });
  }

  const tipoLabel = tipoInfo.label.toUpperCase();
  const tipoSize = 8;
  const tipoWidth = fontBold.widthOfTextAtSize(tipoLabel, tipoSize);
  page.drawText(tipoLabel, {
    x: pageWidth - margin - tipoWidth,
    y: y - (opts.subtitulo ? 24 : 16),
    size: tipoSize,
    font: fontBold,
    color: tipoInfo.color,
  });

  y -= ringR * 2 + 8;
  page.drawRectangle({
    x: margin,
    y,
    width: pageWidth - margin * 2,
    height: 3,
    color: tipoInfo.color,
  });
  y -= 18;

  return y;
}

type ReportFooterOpts = {
  page: PDFPage;
  margin: number;
  pageWidth: number;
  font: PDFFont;
  fontBold: PDFFont;
  legalLine?: string;
  generatedAt?: string;
};

/** Rodapé padrão CB MOVE com faixa arco-íris (relatório financeiro / design system). */
export function drawCbMoveDocumentFooter(opts: ReportFooterOpts) {
  const { page, margin, pageWidth, font } = opts;
  drawRainbowStrip(page, margin, margin + 14, pageWidth - margin * 2, 3);
  const legal =
    opts.legalLine ?? "CB MOVE NEUROSCIENCE LTDA · CNPJ 42.082.795/0001-74 · CREFITO E-4651-RS";
  page.drawText(legal, {
    x: margin,
    y: margin + 4,
    size: 6.5,
    font,
    color: BRAND.inkLight,
  });
  if (opts.generatedAt) {
    const gen = `Documento gerado em ${opts.generatedAt}`;
    page.drawText(gen, {
      x: margin,
      y: margin - 6,
      size: 6.5,
      font,
      color: BRAND.inkLight,
    });
  }
}
