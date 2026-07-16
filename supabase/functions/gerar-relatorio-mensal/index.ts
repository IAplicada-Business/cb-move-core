import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

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

  const cyan = rgb(0.02, 0.6, 0.65);
  const dark = rgb(0.12, 0.12, 0.14);
  const gray = rgb(0.45, 0.45, 0.48);

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

  // Cabeçalho
  page.drawText("CB MOVE Neuroscience", { x: margin, y, size: 16, font: fontBold, color: cyan });
  y -= 22;
  page.drawText(params.titulo, { x: margin, y, size: 12, font: fontBold, color: dark });
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.87),
  });
  y -= 24;

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

  page.drawText(
    `Documento gerado pela CB MOVE Neuroscience em ${new Date().toLocaleDateString("pt-BR")}`,
    { x: margin, y: margin - 10, size: 8, font: fontRegular, color: gray },
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

    const { paciente_id, mes, ano } = await req.json();
    if (!paciente_id || !mes || !ano) throw new Error("paciente_id, mes e ano obrigatórios");

    const { data: paciente, error: pacErr } = await supabase
      .from("pacientes")
      .select("*, convenios(nome, cnpj), fisioterapeutas(nome)")
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
      .select("*, fisioterapeutas(nome)")
      .eq("paciente_id", paciente_id)
      .gte("data", inicioMes)
      .lte("data", fimMes);

    const { data: evolucoes } = await supabase
      .from("prontuario_evolucoes")
      .select("subjetivo, objetivo, plano, data")
      .eq("paciente_id", paciente_id)
      .gte("data", inicioMes)
      .lte("data", fimMes)
      .order("data");

    const totalSessoes = (sessoes ?? []).filter((s: { sigla?: string }) =>
      ["P", "RC"].includes(s.sigla ?? "")
    ).length;
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
      total_sessoes: String(totalSessoes),
      evolucao_resumo: evolucaoResumo || "Sem evoluções registradas no período.",
      plano_terapeutico: planoTerapeutico,
      fisio_nome: paciente.fisioterapeutas?.nome ?? "",
      processo: paciente.numero_processo ?? "",
      convenio_nome: paciente.convenios?.nome ?? "",
      convenio_cnpj: paciente.convenios?.cnpj ?? "",
      cid: "",
      sessoes: String(totalSessoes),
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

    const pdfBytes = await gerarPdf({
      titulo: MODELO_TITULO[modelo] ?? "Relatório de Atendimento",
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
      })
      .select()
      .single();
    if (relErr) throw relErr;

    return new Response(
      JSON.stringify({
        relatorio_id: relatorio.id,
        modelo,
        paciente_nome: paciente.nome,
        competencia: `${MES_NOME[mes]}/${ano}`,
        total_sessoes: totalSessoes,
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
