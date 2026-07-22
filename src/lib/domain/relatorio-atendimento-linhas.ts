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

export function isSessaoRealizada(sigla: string | null | undefined): boolean {
  return !!sigla && SIGLAS_REALIZADAS.has(sigla);
}

export function countSessoesRealizadas(sessoes: SessaoRelatorioInput[]): number {
  return sessoes.filter((s) => isSessaoRealizada(s.sigla)).length;
}

export function calcularRodapeFinanceiro(
  numSessoes: number,
  valorSessao: number,
): RelatorioRodapeFinanceiro {
  const valorTotal = Math.round(numSessoes * valorSessao * 100) / 100;
  return { numSessoes, valorSessao, valorTotal };
}

/** Grade: uma linha por (data, fisio). Rodapé usa count de sessões P/RC, não linhas. */
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
    .filter((s) => isSessaoRealizada(s.sigla))
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

/** Converte texto livre de frequência para rodapé do PDF (ex.: "2 VEZES POR SEMANA"). */
export function formatFrequenciaRodape(frequenciaAtendimento: string | null | undefined): string {
  if (!frequenciaAtendimento?.trim()) return "—";
  const text = frequenciaAtendimento.trim();
  const match = text.match(/(\d+)/);
  if (match) return `${match[1]} VEZES POR SEMANA`;
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
