import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { BRAND, drawCbMoveDocumentFooter, drawCbMoveReportHeader } from "../pdf-brand.ts";
import type { RelatorioRenderContext } from "../types.ts";

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxCharsPerLine) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

const MODELO_TITULO: Record<string, string> = {
  convencional: "Relatório de Atendimento",
  unimed: "Relatório de Atendimento — Unimed",
  sharepoint: "Relatório de Atendimento — Processo Judicial",
  puc: "Relatório de Atendimento — PUC",
};

export async function gerarPdfLegado(ctx: RelatorioRenderContext): Promise<Uint8Array> {
  const titulo = MODELO_TITULO[ctx.modelo] ?? MODELO_TITULO.convencional;
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const dark = BRAND.ink;
  const gray = BRAND.inkLight;

  function ensureSpace(lineHeight: number) {
    if (y - lineHeight < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawHeading(text: string, size: number, font = fontBold, color = dark, gap = 6) {
    ensureSpace(size + gap);
    page.drawText(text, { x: margin, y, size, font, color });
    y -= size + gap;
  }

  function drawParagraph(text: string, size = 10, font = fontRegular, color = dark, maxChars = 95) {
    const lines = wrapText(text, maxChars);
    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + 4;
    }
  }

  y = drawCbMoveReportHeader({
    page,
    pageWidth,
    pageHeight,
    margin,
    y,
    titulo,
    subtitulo: "Relatório de Atendimento · CB MOVE Neuroscience",
    tipoPaciente: ctx.tipoPaciente,
    font: fontRegular,
    fontBold,
  });

  drawHeading(`Paciente: ${ctx.placeholders.paciente_nome ?? "—"}`, 11, fontBold);
  if (ctx.placeholders.paciente_cpf) {
    drawParagraph(`CPF: ${ctx.placeholders.paciente_cpf}`, 10, fontRegular, gray);
  }
  drawParagraph(`Competência: ${ctx.placeholders.competencia ?? "—"}`, 10, fontRegular, gray);
  drawParagraph(
    `Total de sessões realizadas no período: ${ctx.placeholders.total_sessoes ?? "0"}`,
    10,
    fontRegular,
    gray,
  );
  y -= 8;

  for (const campo of ctx.camposExtras) {
    if (!campo.valor) continue;
    drawParagraph(`${campo.label}: ${campo.valor}`, 10, fontRegular, gray);
  }
  y -= 8;

  drawHeading("Resumo da evolução clínica", 11, fontBold);
  drawParagraph(ctx.evolucaoResumo || "Sem evoluções registradas no período.", 10);
  y -= 8;

  if (ctx.planoTerapeutico) {
    drawHeading("Plano terapêutico", 11, fontBold);
    drawParagraph(ctx.planoTerapeutico, 10);
    y -= 8;
  }

  ensureSpace(60);
  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 220, y },
    thickness: 1,
    color: dark,
  });
  y -= 14;
  page.drawText("Assinatura do responsável técnico", {
    x: margin,
    y,
    size: 9,
    font: fontRegular,
    color: gray,
  });

  drawCbMoveDocumentFooter({
    page,
    margin,
    pageWidth,
    font: fontRegular,
    fontBold,
    generatedAt: new Date().toLocaleDateString("pt-BR"),
  });

  return doc.save();
}
