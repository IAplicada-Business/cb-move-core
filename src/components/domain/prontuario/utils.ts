import type { PacienteTipo, FrequenciaSigla } from "@/lib/types";
import type {
  EvolucaoComRelacoes,
  RelatorioAtendimento,
  SessaoProntuario,
} from "@/lib/queries/prontuario";

import { mesLabel } from "./constants";

const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function pacienteCodigoCurto(id: string): string {
  return `#PT${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export function tipoPacienteLabel(tipo: PacienteTipo, convenioNome?: string | null): string {
  const base: Record<PacienteTipo, string> = {
    particular: "PARTICULAR",
    judicial: "JUDICIAL",
    convenio: "CONVÊNIO",
    puc: "PUC",
  };
  const label = base[tipo] ?? tipo.toUpperCase();
  if (convenioNome) return `${label} · ${convenioNome.toUpperCase()}`;
  return label;
}

export function formatDataEvolucao(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  const weekday = DIAS_SEMANA[d.getDay()];
  return `${dia}/${mes}/${ano} · ${weekday}`;
}

export function evolucaoStatus(ev: {
  subjetivo: string | null;
  objetivo: string | null;
  plano: string | null;
  transcricao_raw: string | null;
  assinado_em?: string | null;
}): "rascunho" | "registrada" | "assinada" {
  if (ev.assinado_em) return "assinada";
  const completa = Boolean(ev.subjetivo?.trim() && ev.objetivo?.trim() && ev.plano?.trim());
  if (completa) return "registrada";
  if (ev.transcricao_raw?.trim() || ev.subjetivo || ev.objetivo || ev.plano) return "rascunho";
  return "rascunho";
}

export function countSessoesRealizadas(sessoes: SessaoProntuario[]): number {
  return sessoes.filter((s) => s.sigla === "P" || s.sigla === "RC").length;
}

export function countEvolucoesMes(evolucoes: { data: string }[], mes: number, ano: number): number {
  return filterPorCompetencia(evolucoes, mes, ano).length;
}

export function filterPorCompetencia<T extends { data: string }>(
  items: T[],
  mes: number,
  ano: number,
): T[] {
  return items.filter((item) => {
    const d = new Date(item.data + "T12:00:00");
    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
  });
}

export function filterSessoesPorCompetencia(
  sessoes: SessaoProntuario[],
  mes: number,
  ano: number,
): SessaoProntuario[] {
  return sessoes.filter((s) => {
    const d = new Date(s.data + "T12:00:00");
    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
  });
}

export const PLANO_TOTAL_PADRAO = 24;

export function plazoSessoesLabel(realizadas: number, total = PLANO_TOTAL_PADRAO): string {
  return `${realizadas} / ${total} sessões`;
}

/** Preferência: P/RC, senão a primeira por ordem já recebida (hora ASC). */
export function resolveSessaoId(sessoes: SessaoProntuario[]): string | null {
  if (sessoes.length === 0) return null;
  if (sessoes.length === 1) return sessoes[0].id;
  const preferred = sessoes.find((s) => s.sigla === "P" || s.sigla === "RC");
  return preferred?.id ?? sessoes[0]?.id ?? null;
}

export function formatHoraSessao(hora: string | null): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}

export function sessaoOptionLabel(s: SessaoProntuario): string {
  const hora = formatHoraSessao(s.hora);
  const fisio = s.fisioterapeutas?.nome ? ` · ${s.fisioterapeutas.nome}` : "";
  return `${hora} · ${s.sigla}${fisio}`;
}

export type HistoricoDocumentoKind = "evolucao_diaria" | "relatorio_mensal" | "documento_fisico";

export type HistoricoDocumentoAssinado = {
  id: string;
  kind: HistoricoDocumentoKind;
  label: string;
  referencia: string;
  assinadoEm: string;
  assinadoPor: string | null;
  pdfUrl: string | null;
  xlsxUrl: string | null;
  formatoArquivo: string | null;
};

export function buildHistoricoDocumentosAssinados(
  evolucoes: EvolucaoComRelacoes[],
  relatorios: RelatorioAtendimento[],
  mes: number,
  ano: number,
): HistoricoDocumentoAssinado[] {
  const rows: HistoricoDocumentoAssinado[] = [];

  for (const ev of filterPorCompetencia(evolucoes, mes, ano)) {
    if (!ev.assinado_em) continue;
    rows.push({
      id: `ev-${ev.id}`,
      kind: "evolucao_diaria",
      label: "Evolução diária",
      referencia: formatDataEvolucao(ev.data),
      assinadoEm: ev.assinado_em,
      assinadoPor: ev.fisioterapeutas?.nome ?? null,
      pdfUrl: null,
      xlsxUrl: null,
      formatoArquivo: null,
    });
  }

  for (const relatorio of relatorios) {
    if (!relatorio.assinado) continue;
    if (relatorio.competencia_mes !== mes || relatorio.competencia_ano !== ano) continue;

    const isFisico = relatorio.modelo_pdf === "documento_fisico";
    rows.push({
      id: `rel-${relatorio.id}`,
      kind: isFisico ? "documento_fisico" : "relatorio_mensal",
      label: isFisico ? "Relatório de atendimento (papel)" : "Relatório mensal",
      referencia: mesLabel(relatorio.competencia_mes, relatorio.competencia_ano),
      assinadoEm: relatorio.assinado_em ?? relatorio.created_at,
      assinadoPor: isFisico ? null : "Assinatura digital",
      pdfUrl: relatorio.pdf_url,
      xlsxUrl: relatorio.xlsx_url,
      formatoArquivo: relatorio.formato_arquivo,
    });
  }

  return rows.sort((a, b) => new Date(b.assinadoEm).getTime() - new Date(a.assinadoEm).getTime());
}
