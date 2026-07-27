import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, StandardFonts, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";
import { authErrorResponse, requireRelatorioStaffUser } from "../_shared/auth.ts";
import {
  buildRelatorioLinhas,
  calcularRodapeRelatorio,
  countSessoesRealizadas,
  formatFrequenciaRodape,
  inferirCargaHoraria,
  relatorioStoragePath,
} from "../_shared/relatorio-atendimento-linhas.ts";
import { gerarPdfGradeV2 } from "../_shared/pdf-grade-v2.ts";
import { BRAND, drawCbMoveDocumentFooter, drawCbMoveReportHeader } from "../_shared/pdf-brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MES_NOME: Record<number, string> = {
  1: "Janeiro",
  2: "Fevereiro",
  3: "Março",
  4: "Abril",
  5: "Maio",
  6: "Junho",
  7: "Julho",
  8: "Agosto",
  9: "Setembro",
  10: "Outubro",
  11: "Novembro",
  12: "Dezembro",
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

  // Cabeçalho padrão CB MOVE (design system / relatório financeiro).
  y = drawCbMoveReportHeader({
    page,
    pageWidth,
    pageHeight,
    margin,
    y,
    titulo: params.titulo,
    subtitulo: "Relatório de Atendimento · CB MOVE Neuroscience",
    tipoPaciente: params.tipoPaciente,
    font: fontRegular,
    fontBold,
  });

  // Dados do paciente / competência
  drawHeading(`Paciente: ${params.placeholders.paciente_nome ?? "—"}`, 11, fontBold);
  if (params.placeholders.paciente_cpf) {
    drawParagraph(`CPF: ${params.placeholders.paciente_cpf}`, 10, fontRegular, gray);
  }
  drawParagraph(`Competência: ${params.placeholders.competencia ?? "—"}`, 10, fontRegular, gray);
  drawParagraph(
    `Total de sessões realizadas no período: ${params.placeholders.total_sessoes ?? "0"}`,
    10,
    fontRegular,
    gray,
  );
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { paciente_id, mes, ano, modelo_pdf: modeloPdfBody } = await req.json();
    if (!paciente_id || !mes || !ano) throw new Error("paciente_id, mes e ano obrigatórios");

    const { admin: supabase } = await requireRelatorioStaffUser(req, paciente_id);

    const modeloPdf = modeloPdfBody === "legado" ? "legado" : "grade_v2";

    const { data: paciente, error: pacErr } = await supabase
      .from("pacientes")
      .select("*, convenios(nome, cnpj), fisioterapeutas!fisioterapeuta_id(nome)")
      .eq("id", paciente_id)
      .single();
    if (pacErr || !paciente) throw new Error("Paciente não encontrado");

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
      .select(
        "id, data, sigla, fisioterapeuta_id, fisioterapeutas!sessoes_fisioterapeuta_id_fkey(nome)",
      )
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
    const rodape = calcularRodapeRelatorio(
      totalSessoes,
      paciente.regime_cobranca,
      paciente.valor_sessao,
      paciente.valor_mensal,
    );
    const cargaHoraria = inferirCargaHoraria(paciente.frequencia_atendimento);
    const linhas = buildRelatorioLinhas(sessoes ?? [], joins, cargaHoraria);
    const frequenciaTexto = formatFrequenciaRodape(paciente.frequencia_atendimento);
    const regimeMensalista = paciente.regime_cobranca === "mensalista";

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
        [e.subjetivo, e.objetivo, e.plano].filter(Boolean).join("\n"),
      )
      .join("\n\n");
    const planoTerapeutico = evolucoes?.[evolucoes.length - 1]?.plano ?? "";

    const cid = paciente.cid ?? "";
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
      cid,
      sessoes: String(totalSessoesLegado),
    };

    const camposExtras: { label: string; valor: string }[] = [];
    if (modelo === "unimed") {
      camposExtras.push({ label: "Convênio", valor: placeholders.convenio_nome });
      camposExtras.push({ label: "Fisioterapeuta", valor: placeholders.fisio_nome });
      if (cid) camposExtras.push({ label: "CID", valor: cid });
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
            modelo,
            tipoPaciente: paciente.tipo ?? "particular",
            camposExtras,
            regimeMensalista,
            valorUnitarioLabel: regimeMensalista ? "MENSAL" : "SESSÃO",
          })
        : await gerarPdf({
            titulo: MODELO_TITULO[modelo] ?? "Relatório de Atendimento",
            tipoPaciente: paciente.tipo ?? "particular",
            placeholders,
            camposExtras,
            evolucaoResumo: placeholders.evolucao_resumo,
            planoTerapeutico,
          });

    const storagePath = relatorioStoragePath(paciente_id, ano, mes);
    const { error: uploadErr } = await supabase.storage
      .from("relatorios-atendimento")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadErr) throw new Error(`Falha ao salvar PDF: ${uploadErr.message}`);

    const relatorioPayload = {
      paciente_id,
      competencia_mes: mes,
      competencia_ano: ano,
      modelo,
      status: "gerado",
      pdf_url: storagePath,
      template_versionado_id: template?.id ?? null,
      modelo_pdf: modeloPdf,
      num_sessoes: rodape.numSessoes,
      valor_sessao: rodape.valorSessao,
      valor_total: rodape.valorTotal,
      frequencia_texto: frequenciaTexto,
      carga_horaria: cargaHoraria,
      assinado: false,
      assinado_em: null,
      assinatura_link: null,
      clicksign_document_key: null,
    };

    const { data: existing } = await supabase
      .from("relatorios_atendimento")
      .select("id")
      .eq("paciente_id", paciente_id)
      .eq("competencia_mes", mes)
      .eq("competencia_ano", ano)
      .in("modelo_pdf", ["grade_v2", "legado"])
      .maybeSingle();

    let relatorio: { id: string };
    if (existing?.id) {
      const { data: updated, error: updErr } = await supabase
        .from("relatorios_atendimento")
        .update(relatorioPayload)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (updErr) throw updErr;
      relatorio = updated;
      await supabase.from("relatorio_atendimento_linhas").delete().eq("relatorio_id", existing.id);
    } else {
      const { data: inserted, error: relErr } = await supabase
        .from("relatorios_atendimento")
        .insert(relatorioPayload)
        .select("id")
        .single();
      if (relErr) throw relErr;
      relatorio = inserted;
    }

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
        pdf_url: storagePath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
