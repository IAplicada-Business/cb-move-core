import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { formatDataRelatorio, formatMoedaBr } from "../../relatorio-atendimento-linhas.ts";
import type { RelatorioRenderContext } from "../types.ts";

/** Planilha institucional PUC — Terapias Complementares. */
export function gerarXlsxPucV1(ctx: RelatorioRenderContext): Uint8Array {
  const rows: unknown[][] = [
    ["CB MOVE Neuroscience — Terapias Complementares (PUC)"],
    ["Relatório de Atendimento Institucional"],
    [],
    ["Paciente", ctx.pacienteNome],
    ["Instituição / Convênio", ctx.placeholders.convenio_nome || "PUC"],
    ["Competência", ctx.competenciaLabel],
    ["Fisioterapeuta", ctx.placeholders.fisio_nome || "—"],
    [],
    ["DATA", "CARGA HORÁRIA", "FISIOTERAPEUTA"],
  ];

  if (ctx.linhas.length === 0) {
    rows.push(["—", ctx.cargaHoraria, "—"]);
  } else {
    for (const linha of ctx.linhas) {
      rows.push([formatDataRelatorio(linha.data), linha.cargaHoraria, linha.fisioterapeutaNome]);
    }
  }

  rows.push(
    [],
    ["FREQUÊNCIA", ctx.frequenciaTexto],
    ["NÚMERO DE SESSÕES", ctx.rodape.numSessoes],
    [
      ctx.regimeMensalista ? "VALOR MENSAL R$" : "VALOR SESSÃO R$",
      formatMoedaBr(ctx.rodape.valorSessao),
    ],
    ["VALOR TOTAL R$", formatMoedaBr(ctx.rodape.valorTotal)],
    [],
    ["Gerado em", new Date().toLocaleDateString("pt-BR")],
  );

  if (ctx.template?.codigo) {
    rows.push(["Template RQ.GPS", ctx.template.codigo]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 36 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório PUC");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf);
}
