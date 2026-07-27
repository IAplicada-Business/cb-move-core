/** Lógica compartilhada (espelho de src/lib/domain/relatorio-atendimento-linhas.ts) */

export type SessaoRelatorioInput = {
  id: string;
  data: string;
  sigla: string | null;
  fisioterapeuta_id: string | null;
  fisioterapeutas?: { nome: string } | null;
};

export type SessaoFisioJoinInput = {
  sessao_id: string;
  fisioterapeuta_id: string;
  fisioterapeutas?: { nome: string } | null;
};

export type RelatorioAtendimentoLinha = {
  data: string;
  cargaHoraria: string;
  fisioterapeutaId: string | null;
  fisioterapeutaNome: string;
  ordemNoDia: number;
};

export type RelatorioRodapeFinanceiro = {
  numSessoes: number;
  valorSessao: number;
  valorTotal: number;
};

const SIGLAS_REALIZADAS = new Set(["P", "RC"]);

export function countSessoesRealizadas(sessoes: SessaoRelatorioInput[]): number {
  return sessoes.filter((s) => s.sigla && SIGLAS_REALIZADAS.has(s.sigla)).length;
}

export function calcularRodapeFinanceiro(
  numSessoes: number,
  valorSessao: number,
): RelatorioRodapeFinanceiro {
  const valorTotal = Math.round(numSessoes * valorSessao * 100) / 100;
  return { numSessoes, valorSessao, valorTotal };
}

export function calcularRodapeRelatorio(
  numSessoes: number,
  regime: string | null | undefined,
  valorSessao: number | null | undefined,
  valorMensal: number | null | undefined,
): RelatorioRodapeFinanceiro {
  if (regime === "mensalista" && valorMensal != null) {
    return { numSessoes, valorSessao: Number(valorMensal), valorTotal: Number(valorMensal) };
  }
  return calcularRodapeFinanceiro(numSessoes, Number(valorSessao ?? 0));
}

export function inferirCargaHoraria(frequenciaAtendimento: string | null | undefined): string {
  if (frequenciaAtendimento && /duplo/i.test(frequenciaAtendimento)) return "2h50";
  return "1h25";
}

export function buildRelatorioLinhas(
  sessoes: SessaoRelatorioInput[],
  joins: SessaoFisioJoinInput[],
  cargaHoraria = "1h25",
): RelatorioAtendimentoLinha[] {
  const joinsBySessao = new Map<string, SessaoFisioJoinInput[]>();
  for (const join of joins) {
    const list = joinsBySessao.get(join.sessao_id) ?? [];
    list.push(join);
    joinsBySessao.set(join.sessao_id, list);
  }

  const realizadas = sessoes
    .filter((s) => s.sigla && SIGLAS_REALIZADAS.has(s.sigla))
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));

  const linhas: RelatorioAtendimentoLinha[] = [];

  for (const sessao of realizadas) {
    const sessJoins = joinsBySessao.get(sessao.id);
    if (sessJoins && sessJoins.length > 0) {
      sessJoins.forEach((join, idx) => {
        linhas.push({
          data: sessao.data,
          cargaHoraria,
          fisioterapeutaId: join.fisioterapeuta_id,
          fisioterapeutaNome: join.fisioterapeutas?.nome?.trim() || "—",
          ordemNoDia: idx + 1,
        });
      });
    } else {
      linhas.push({
        data: sessao.data,
        cargaHoraria,
        fisioterapeutaId: sessao.fisioterapeuta_id,
        fisioterapeutaNome: sessao.fisioterapeutas?.nome?.trim() || "—",
        ordemNoDia: 1,
      });
    }
  }

  return linhas;
}

export function formatFrequenciaRodape(frequenciaAtendimento: string | null | undefined): string {
  if (!frequenciaAtendimento?.trim()) return "—";
  const text = frequenciaAtendimento.trim();
  const match = text.match(/(\d+)\s*x?\s*(?:por\s*)?semana/i);
  if (match) {
    const duplo = /duplo/i.test(text) ? " (DUPLA)" : "";
    return `${match[1]} VEZES POR SEMANA${duplo}`;
  }
  return text.toUpperCase();
}

export function formatMoedaBr(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDataRelatorio(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y.slice(-2)}`;
}

export function relatorioStoragePath(pacienteId: string, ano: number, mes: number): string {
  return `relatorio-${pacienteId}-${ano}-${String(mes).padStart(2, "0")}.pdf`;
}

export function resolveStoragePathFromPdfRef(pdfRef: string | null | undefined): string | null {
  if (!pdfRef?.trim()) return null;
  const trimmed = pdfRef.trim();
  if (!trimmed.startsWith("http")) return trimmed;
  const marker = "/relatorios-atendimento/";
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(trimmed.slice(idx + marker.length).split("?")[0] ?? "");
}
