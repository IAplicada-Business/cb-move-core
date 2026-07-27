import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildRelatorioLinhas,
  calcularRodapeRelatorio,
  countSessoesRealizadas,
  formatFrequenciaRodape,
  inferirCargaHoraria,
  relatorioStoragePath,
} from "./relatorio-atendimento-linhas.ts";
import { renderRelatorioWithDual } from "./relatorio/render-relatorio.ts";
import { isJudicialDualOutput, selectRenderer } from "./relatorio/select-renderer.ts";
import type { ModeloRelatorio, RelatorioRenderContext } from "./relatorio/types.ts";
import { validateRelatorioContext } from "./relatorio/validate-template.ts";

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

export type GerarRelatorioMensalResult = {
  relatorio_id: string;
  modelo: string;
  modelo_pdf: "grade_v2" | "legado";
  formato_arquivo: "pdf" | "xlsx" | "dual";
  paciente_nome: string;
  competencia: string;
  total_sessoes: number;
  num_sessoes: number;
  valor_sessao: number;
  valor_total: number;
  pdf_url: string;
  xlsx_url?: string;
};

function resolveModelo(paciente: {
  modelo_relatorio_preferido?: string | null;
  tipo?: string | null;
}): ModeloRelatorio {
  if (paciente.modelo_relatorio_preferido) {
    return paciente.modelo_relatorio_preferido as ModeloRelatorio;
  }
  if (paciente.tipo === "judicial") return "sharepoint";
  if (paciente.tipo === "convenio") return "unimed";
  if (paciente.tipo === "puc") return "puc";
  return "convencional";
}

function buildCamposExtras(
  modelo: ModeloRelatorio,
  placeholders: Record<string, string>,
): { label: string; valor: string }[] {
  const camposExtras: { label: string; valor: string }[] = [];
  if (modelo === "unimed") {
    camposExtras.push({ label: "Convênio", valor: placeholders.convenio_nome });
    camposExtras.push({ label: "Fisioterapeuta", valor: placeholders.fisio_nome });
    if (placeholders.cid) camposExtras.push({ label: "CID", valor: placeholders.cid });
  } else if (modelo === "sharepoint") {
    camposExtras.push({ label: "Processo", valor: placeholders.processo });
    camposExtras.push({ label: "Fisioterapeuta", valor: placeholders.fisio_nome });
  } else if (modelo === "puc") {
    camposExtras.push({ label: "Convênio/Instituição", valor: placeholders.convenio_nome });
  }
  return camposExtras;
}

export async function executeGerarRelatorioMensal(
  supabase: SupabaseClient,
  params: {
    paciente_id: string;
    mes: number;
    ano: number;
    modelo_pdf?: string;
  },
): Promise<GerarRelatorioMensalResult> {
  const { paciente_id, mes, ano, modelo_pdf: modeloPdfBody } = params;

  const { data: paciente, error: pacErr } = await supabase
    .from("pacientes")
    .select("*, convenios(nome, cnpj), fisioterapeutas!fisioterapeuta_id(nome)")
    .eq("id", paciente_id)
    .single();
  if (pacErr || !paciente) throw new Error("Paciente não encontrado");

  const modelo = resolveModelo(paciente);

  const { data: template } = await supabase
    .from("templates_versionados")
    .select("id, codigo, conteudo")
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
  const competenciaLabel = `${MES_NOME[mes]}/${ano}`;

  const { data: evolucoes } = await supabase
    .from("prontuario_evolucoes")
    .select("subjetivo, objetivo, plano, data")
    .eq("paciente_id", paciente_id)
    .gte("data", inicioMes)
    .lte("data", fimMes)
    .order("data");

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
    competencia: competenciaLabel,
    total_sessoes: String(totalSessoes),
    evolucao_resumo: evolucaoResumo || "Sem evoluções registradas no período.",
    plano_terapeutico: planoTerapeutico,
    fisio_nome: paciente.fisioterapeutas?.nome ?? "",
    processo: paciente.numero_processo ?? "",
    convenio_nome: paciente.convenios?.nome ?? "",
    convenio_cnpj: paciente.convenios?.cnpj ?? "",
    cid,
    sessoes: String(totalSessoes),
  };

  validateRelatorioContext(
    isJudicialDualOutput(paciente.tipo, modeloPdfBody) ? "sharepoint" : modelo,
    placeholders,
    template?.conteudo,
  );

  const selection = selectRenderer(modelo, template?.conteudo, modeloPdfBody, paciente.tipo);

  const ctx: RelatorioRenderContext = {
    modelo,
    tipoPaciente: paciente.tipo ?? "particular",
    pacienteNome: paciente.nome,
    competenciaLabel,
    competenciaMes: mes,
    competenciaAno: ano,
    frequenciaTexto,
    cargaHoraria,
    linhas,
    rodape,
    regimeMensalista,
    placeholders,
    camposExtras: buildCamposExtras(modelo, placeholders),
    evolucaoResumo: placeholders.evolucao_resumo,
    planoTerapeutico,
    template: template
      ? { id: template.id, codigo: template.codigo, conteudo: template.conteudo }
      : null,
  };

  const rendered = await renderRelatorioWithDual(ctx, selection);

  const pdfPath = relatorioStoragePath(paciente_id, ano, mes, "pdf");
  let pdfUrl: string | null = null;
  let xlsxUrl: string | null = null;

  if ("xlsxBytes" in rendered) {
    xlsxUrl = relatorioStoragePath(paciente_id, ano, mes, "xlsx");
    const { error: xlsxErr } = await supabase.storage
      .from("relatorios-atendimento")
      .upload(xlsxUrl, rendered.xlsxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
    if (xlsxErr) throw new Error(`Falha ao salvar XLSX: ${xlsxErr.message}`);

    const { error: pdfErr } = await supabase.storage
      .from("relatorios-atendimento")
      .upload(pdfPath, rendered.pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (pdfErr) throw new Error(`Falha ao salvar PDF: ${pdfErr.message}`);
    pdfUrl = pdfPath;
  } else {
    const ext = selection.formato_arquivo === "xlsx" ? "xlsx" : "pdf";
    const singlePath = relatorioStoragePath(paciente_id, ano, mes, ext);
    const { error: uploadErr } = await supabase.storage
      .from("relatorios-atendimento")
      .upload(singlePath, rendered.bytes, { contentType: selection.contentType, upsert: true });
    if (uploadErr) throw new Error(`Falha ao salvar arquivo: ${uploadErr.message}`);
    if (ext === "xlsx") xlsxUrl = singlePath;
    else pdfUrl = singlePath;
  }

  const relatorioPayload = {
    paciente_id,
    competencia_mes: mes,
    competencia_ano: ano,
    modelo,
    status: "gerado",
    pdf_url: pdfUrl,
    xlsx_url: xlsxUrl,
    formato_arquivo: selection.formato_arquivo,
    template_versionado_id: template?.id ?? null,
    modelo_pdf: selection.modelo_pdf,
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
    .select("id, pdf_url, xlsx_url, formato_arquivo")
    .eq("paciente_id", paciente_id)
    .eq("competencia_mes", mes)
    .eq("competencia_ano", ano)
    .in("modelo_pdf", ["grade_v2", "legado"])
    .maybeSingle();

  const pathsToRemove = new Set<string>();
  if (existing?.pdf_url && existing.pdf_url !== pdfUrl) {
    pathsToRemove.add(existing.pdf_url);
  }
  if (existing?.xlsx_url && existing.xlsx_url !== xlsxUrl) {
    pathsToRemove.add(existing.xlsx_url);
  }
  if (pdfUrl && existing?.pdf_url?.endsWith(".xlsx") && existing.pdf_url !== pdfUrl) {
    pathsToRemove.add(existing.pdf_url);
  }
  if (pathsToRemove.size > 0) {
    await supabase.storage.from("relatorios-atendimento").remove([...pathsToRemove]);
  }

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

  if (selection.modelo_pdf === "grade_v2" && linhas.length > 0) {
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

  return {
    relatorio_id: relatorio.id,
    modelo,
    modelo_pdf: selection.modelo_pdf,
    formato_arquivo: selection.formato_arquivo,
    paciente_nome: paciente.nome,
    competencia: competenciaLabel,
    total_sessoes: totalSessoes,
    num_sessoes: rodape.numSessoes,
    valor_sessao: rodape.valorSessao,
    valor_total: rodape.valorTotal,
    pdf_url: pdfUrl ?? xlsxUrl ?? "",
    ...(xlsxUrl ? { xlsx_url: xlsxUrl } : {}),
  };
}
