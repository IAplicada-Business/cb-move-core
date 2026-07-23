import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";
import {
  buildRelatorioLinhas,
  calcularRodapeFinanceiro,
  countSessoesRealizadas,
  formatFrequenciaRodape,
} from "../_shared/relatorio-atendimento-linhas.ts";
import { gerarPdfGradeV2 } from "../_shared/pdf-grade-v2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MES_NOME: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
  7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

const MODELO_TITULO: Record<string, string> = {
  convencional: "Relatório de Atendimento",
  unimed: "Relatório de Atendimento — Unimed",
  sharepoint: "Relatório de Atendimento — Processo Judicial",
  puc: "Relatório de Atendimento — PUC",
};

// Paleta oficial CB MOVE (mesma usada no design system do sistema).
const BRAND = {
  ink: rgb(0.173, 0.173, 0.173),
  inkLight: rgb(0.420, 0.420, 0.450),
  paper: rgb(1, 1, 1),
  line: rgb(0.886, 0.898, 0.910),
  cyan700: rgb(0.176, 0.514, 0.533),
  cyan600: rgb(0.247, 0.710, 0.737),
  magenta: rgb(0.851, 0.275, 0.627),
  orange: rgb(0.961, 0.541, 0.122),
  lime: rgb(0.773, 0.851, 0.196),
  purple: rgb(0.482, 0.310, 0.710),
};

const TIPO_ACCENT: Record<string, { label: string; color: ReturnType<typeof rgb> }> = {
  particular: { label: "Particular", color: BRAND.cyan700 },
  judicial: { label: "Judicial", color: BRAND.magenta },
  convenio: { label: "Convênio", color: BRAND.purple },
  puc: { label: "PUC", color: BRAND.orange },
};

// Anel de 5 arcos sólidos (réplica do anel colorido da marca CB MOVE, sem gradiente).
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

function drawBrandRing(page: PDFPage, cx: number, cy: number, r: number, thickness: number) {
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

function drawRainbowStrip(page: PDFPage, x: number, y: number, width: number, height: number) {
  const colors = [BRAND.magenta, BRAND.orange, BRAND.lime, BRAND.cyan600, BRAND.purple];
  const segWidth = width / colors.length;
  colors.forEach((color, i) => {
    page.drawRectangle({ x: x + i * segWidth, y, width: segWidth, height, color });
  });
}

function substituirPlaceholders(template: string, dados: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => dados[key] ?? `{{${key}}}`);
}

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

async function gerarPdf(params: {
  titulo: string;
  tipoPaciente: string;
  placeholders: Record<string, string>;
  camposExtras: { label: string; valor: string }[];
  evolucaoResumo: string;
  planoTerapeutico: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const dark = BRAND.ink;
  const gray = BRAND.inkLight;
  const tipoInfo = TIPO_ACCENT[params.tipoPaciente] ?? TIPO_ACCENT.particular;

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

  // Cabeçalho com a marca CB MOVE — anel de 5 cores + wordmark, título e
  // selo do tipo de paciente à direita, barra de destaque colorida abaixo.
  const ringR = 9;
  const ringCx = margin + ringR;
  const ringCy = y - ringR;
  drawBrandRing(page, ringCx, ringCy, ringR, 2.2);
  page.drawEllipse({ x: ringCx, y: ringCy, xScale: 5, yScale: 5, color: BRAND.paper });

  page.drawText("CB MOVE", { x: margin + ringR * 2 + 8, y: y - 4, size: 13, font: fontBold, color: dark });
  page.drawText("NEUROSCIENCE", { x: margin + ringR * 2 + 8, y: y - 15, size: 6.5, font: fontRegular, color: gray });

  const tituloSize = 11;
  const tituloWidth = fontBold.widthOfTextAtSize(params.titulo, tituloSize);
  page.drawText(params.titulo, { x: pageWidth - margin - tituloWidth, y: y - 4, size: tituloSize, font: fontBold, color: dark });

  const tipoLabel = tipoInfo.label.toUpperCase();
  const tipoLabelSize = 8;
  const tipoLabelWidth = fontBold.widthOfTextAtSize(tipoLabel, tipoLabelSize);
  page.drawText(tipoLabel, {
    x: pageWidth - margin - tipoLabelWidth,
    y: y - 16,
    size: tipoLabelSize,
    font: fontBold,
    color: tipoInfo.color,
  });

  y -= ringR * 2 + 10;
  page.drawRectangle({ x: margin, y, width: pageWidth - margin * 2, height: 3, color: tipoInfo.color });
  y -= 22;

  // Dados do paciente / competência
  drawHeading(`Paciente: ${params.placeholders.paciente_nome ?? "—"}`, 11, fontBold);
  if (params.placeholders.paciente_cpf) {
    drawParagraph(`CPF: ${params.placeholders.paciente_cpf}`, 10, fontRegular, gray);
  }
  drawParagraph(`Competência: ${params.placeholders.competencia ?? "—"}`, 10, fontRegular, gray);
  drawParagraph(`Total de sessões realizadas no período: ${params.placeholders.total_sessoes ?? "0"}`, 10, fontRegular, gray);
  y -= 8;

  for (const campo of params.camposExtras) {
    if (!campo.valor) continue;
    drawParagraph(`${campo.label}: ${campo.valor}`, 10, fontRegular, gray);
  }
  y -= 8;

  drawHeading("Resumo da evolução clínica", 11, fontBold);
  drawParagraph(params.evolucaoResumo || "Sem evoluções registradas no período.", 10);
  y -= 8;

  if (params.planoTerapeutico) {
    drawHeading("Plano terapêutico", 11, fontBold);
    drawParagraph(params.planoTerapeutico, 10);
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
  page.drawText("Assinatura do responsável técnico", { x: margin, y, size: 9, font: fontRegular, color: gray });

  // Rodapé com a faixa arco-íris da marca CB MOVE.
  drawRainbowStrip(page, margin, margin - 4, pageWidth - margin * 2, 3);
  page.drawText(
    `Documento gerado pela CB MOVE Neuroscience em ${new Date().toLocaleDateString("pt-BR")}`,
    { x: margin, y: margin - 16, size: 8, font: fontRegular, color: gray },
  );

  return doc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { paciente_id, mes, ano, modelo_pdf: modeloPdfBody } = await req.json();
    if (!paciente_id || !mes || !ano) throw new Error("paciente_id, mes e ano obrigatórios");
    const modeloPdf = modeloPdfBody === "legado" ? "legado" : "grade_v2";
    const cargaHoraria = "1h25";

    const { data: paciente, error: pacErr } = await supabase
      .from("pacientes")
      .select("*, convenios(nome, cnpj), fisioterapeutas!fisioterapeuta_id(nome)")
      .eq("id", paciente_id)
      .single();
    if (pacErr || !paciente) throw new Error("Paciente não encontrado");

    // Determina modelo pelo tipo do paciente e convênio (preferência do paciente tem prioridade)
    let modelo = "convencional";
    if (paciente.modelo_relatorio_preferido) {
      modelo = paciente.modelo_relatorio_preferido;
    } else if (paciente.tipo === "judicial") {
      modelo = "sharepoint";
    } else if (paciente.tipo === "convenio") {
      modelo = "unimed";
    } else if (paciente.tipo === "puc") {
      modelo = "puc";
    }

    const { data: template } = await supabase
      .from("templates_versionados")
      .select("*")
      .eq("tipo", "relatorio_atendimento")
      .eq("modelo", modelo)
      .eq("ativo", true)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fimMes = new Date(ano, mes, 0).toISOString().split("T")[0];
    const { data: sessoes } = await supabase
      .from("sessoes")
      .select("id, data, sigla, fisioterapeuta_id, fisioterapeutas!sessoes_fisioterapeuta_id_fkey(nome)")
      .eq("paciente_id", paciente_id)
      .gte("data", inicioMes)
      .lte("data", fimMes);

    const sessaoIds = (sessoes ?? []).map((s: { id: string }) => s.id);
    let joins: Array<{
      sessao_id: string;
      fisioterapeuta_id: string;
      fisioterapeutas?: { nome: string } | null;
    }> = [];
    if (sessaoIds.length > 0) {
      const { data: joinRows } = await supabase
        .from("sessao_fisioterapeutas")
        .select("sessao_id, fisioterapeuta_id, fisioterapeutas(nome)")
        .in("sessao_id", sessaoIds);
      joins = joinRows ?? [];
    }

    const totalSessoes = countSessoesRealizadas(sessoes ?? []);
    const valorSessao = Number(paciente.valor_sessao ?? 0);
    const rodape = calcularRodapeFinanceiro(totalSessoes, valorSessao);
    const linhas = buildRelatorioLinhas(sessoes ?? [], joins, cargaHoraria);
    const frequenciaTexto = formatFrequenciaRodape(paciente.frequencia_atendimento);

    const { data: evolucoes } = await supabase
      .from("prontuario_evolucoes")
      .select("subjetivo, objetivo, plano, data")
      .eq("paciente_id", paciente_id)
      .gte("data", inicioMes)
      .lte("data", fimMes)
      .order("data");

    const totalSessoesLegado = totalSessoes;
    const evolucaoResumo = (evolucoes ?? [])
      .map((e: { subjetivo?: string; objetivo?: string; plano?: string }) =>
        [e.subjetivo, e.objetivo, e.plano].filter(Boolean).join("\n")
      )
      .join("\n\n");
    const planoTerapeutico = evolucoes?.[evolucoes.length - 1]?.plano ?? "";

    const placeholders: Record<string, string> = {
      paciente_nome: paciente.nome,
      paciente_cpf: paciente.cpf ?? "",
      competencia: `${MES_NOME[mes]}/${ano}`,
      total_sessoes: String(totalSessoesLegado),
      evolucao_resumo: evolucaoResumo || "Sem evoluções registradas no período.",
      plano_terapeutico: planoTerapeutico,
      fisio_nome: paciente.fisioterapeutas?.nome ?? "",
      processo: paciente.numero_processo ?? "",
      convenio_nome: paciente.convenios?.nome ?? "",
      convenio_cnpj: paciente.convenios?.cnpj ?? "",
      cid: "",
      sessoes: String(totalSessoesLegado),
    };

    const camposExtras: { label: string; valor: string }[] = [];
    if (modelo === "unimed") {
      camposExtras.push({ label: "Convênio", valor: placeholders.convenio_nome });
      camposExtras.push({ label: "Fisioterapeuta", valor: placeholders.fisio_nome });
    } else if (modelo === "sharepoint") {
      camposExtras.push({ label: "Processo", valor: placeholders.processo });
      camposExtras.push({ label: "Fisioterapeuta", valor: placeholders.fisio_nome });
    } else if (modelo === "puc") {
      camposExtras.push({ label: "Convênio/Instituição", valor: placeholders.convenio_nome });
    }

    const pdfBytes =
      modeloPdf === "grade_v2"
        ? await gerarPdfGradeV2({
            pacienteNome: paciente.nome,
            competenciaLabel: `${MES_NOME[mes]}/${ano}`,
            frequenciaTexto,
            linhas,
            numSessoes: rodape.numSessoes,
            valorSessao: rodape.valorSessao,
            valorTotal: rodape.valorTotal,
            cargaHoraria,
          })
        : await gerarPdf({
            titulo: MODELO_TITULO[modelo] ?? "Relatório de Atendimento",
            tipoPaciente: paciente.tipo ?? "particular",
            placeholders,
            camposExtras,
            evolucaoResumo: placeholders.evolucao_resumo,
            planoTerapeutico,
          });

    const fileName = `relatorio-${paciente_id}-${ano}-${String(mes).padStart(2, "0")}-${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("relatorios-atendimento")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadErr) throw new Error(`Falha ao salvar PDF: ${uploadErr.message}`);

    const { data: publicUrlData } = supabase.storage
      .from("relatorios-atendimento")
      .getPublicUrl(fileName);
    const pdfUrl = publicUrlData.publicUrl;

    const { data: relatorio, error: relErr } = await supabase
      .from("relatorios_atendimento")
      .insert({
        paciente_id,
        competencia_mes: mes,
        competencia_ano: ano,
        modelo,
        status: "gerado",
        pdf_url: pdfUrl,
        template_versionado_id: template?.id ?? null,
        modelo_pdf: modeloPdf,
        num_sessoes: rodape.numSessoes,
        valor_sessao: rodape.valorSessao,
        valor_total: rodape.valorTotal,
        frequencia_texto: frequenciaTexto,
        carga_horaria: cargaHoraria,
      })
      .select()
      .single();
    if (relErr) throw relErr;

    if (modeloPdf === "grade_v2" && linhas.length > 0) {
      const { error: linhasErr } = await supabase.from("relatorio_atendimento_linhas").insert(
        linhas.map((l) => ({
          relatorio_id: relatorio.id,
          data: l.data,
          carga_horaria: l.cargaHoraria,
          fisioterapeuta_id: l.fisioterapeutaId,
          fisioterapeuta_nome: l.fisioterapeutaNome,
          ordem_no_dia: l.ordemNoDia,
        })),
      );
      if (linhasErr) throw new Error(`Falha ao salvar linhas: ${linhasErr.message}`);
    }

    return new Response(
      JSON.stringify({
        relatorio_id: relatorio.id,
        modelo,
        modelo_pdf: modeloPdf,
        paciente_nome: paciente.nome,
        competencia: `${MES_NOME[mes]}/${ano}`,
        total_sessoes: totalSessoesLegado,
        num_sessoes: rodape.numSessoes,
        valor_sessao: rodape.valorSessao,
        valor_total: rodape.valorTotal,
        pdf_url: pdfUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
