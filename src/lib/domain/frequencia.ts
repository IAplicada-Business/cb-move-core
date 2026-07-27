import type { FrequenciaSigla, StatusAgendamento } from "@/lib/types";

export const SIGLAS_REALIZADAS: FrequenciaSigla[] = ["P", "RC"];

export const SIGLA_HINT: Record<FrequenciaSigla, string> = {
  P: "Presente",
  F: "Falta",
  FJ: "Falta justificada",
  NJ: "Não justificada",
  RC: "Reabilitação concluída",
  NR: "Não realizada",
};

/** Mapeia sigla da planilha para status do agendamento (P/RC → realizado; demais → faltou). */
export function statusAgendamentoFromSigla(sigla: FrequenciaSigla): StatusAgendamento {
  return sigla === "P" || sigla === "RC" ? "realizado" : "faltou";
}

/** Sigla genérica espelhada a partir do status (fluxo legado de updateAgendamentoStatus). */
export function siglaEspelhoFromStatus(status: StatusAgendamento): FrequenciaSigla | null {
  if (status === "realizado") return "P";
  if (status === "faltou") return "F";
  return null;
}

/** Preserva siglas finas (FJ, RC, etc.) ao espelhar status em sessoes. */
export function deveEspelharSiglaStatus(
  siglaExistente: FrequenciaSigla | null,
  siglaAlvo: FrequenciaSigla,
): boolean {
  if (!siglaExistente) return true;
  if (siglaExistente === "P" || siglaExistente === "F") return true;
  return false;
}

export type MoveSessaoSiglaAcao = "none" | "move" | "clear_only";

export function resolveMoveSessaoSiglaDia(opts: {
  siglaOrigem: FrequenciaSigla | null;
  siglaDestino: FrequenciaSigla | null;
}): { acao: MoveSessaoSiglaAcao; sigla?: FrequenciaSigla } {
  if (!opts.siglaOrigem) return { acao: "none" };
  if (opts.siglaDestino) return { acao: "clear_only" };
  return { acao: "move", sigla: opts.siglaOrigem };
}

const FREQ_HISTORICO_PREFIX = "frequencia:";

export function formatSiglaHistorico(sigla: FrequenciaSigla): string {
  return `${FREQ_HISTORICO_PREFIX}${sigla}`;
}

export function parseSiglaHistorico(valor: string | null): FrequenciaSigla | null {
  if (!valor?.startsWith(FREQ_HISTORICO_PREFIX)) return null;
  const sigla = valor.slice(FREQ_HISTORICO_PREFIX.length) as FrequenciaSigla;
  return SIGLA_HINT[sigla] ? sigla : null;
}

export type SessaoSigla = { sigla: FrequenciaSigla };

export type MetricaComparecimento = {
  realizadas: number;
  esperadas: number | null;
  taxa: number | null;
  frequenciaLabel: string | null;
};

export function contarRealizadas(sessoes: SessaoSigla[]): number {
  return sessoes.filter((s) => SIGLAS_REALIZADAS.includes(s.sigla)).length;
}

export function extrairMultiplicadorPlano(frequenciaAtendimento: string): number {
  const texto = frequenciaAtendimento.toLowerCase();
  if (texto.includes("triplo")) return 3;
  if (texto.includes("duplo")) return 2;
  return 1;
}

/** Estima sessões esperadas no mês a partir do texto de frequência cadastrada. */
export function estimarSessoesEsperadasMes(
  frequenciaAtendimento: string | null | undefined,
): number | null {
  const texto = frequenciaAtendimento?.trim();
  if (!texto) return null;

  const match = texto.match(/(\d+)\s*x\s*semana/i);
  if (!match) return null;

  const vezesPorSemana = Number(match[1]);
  if (!Number.isFinite(vezesPorSemana) || vezesPorSemana <= 0) return null;

  const multiplicador = extrairMultiplicadorPlano(texto);
  return vezesPorSemana * multiplicador * 4;
}

export function resolverSessoesEsperadas(opts: {
  qtdSessoesCobranca?: number | null;
  frequenciaAtendimento?: string | null;
}): number | null {
  if (opts.qtdSessoesCobranca != null && opts.qtdSessoesCobranca > 0) {
    return opts.qtdSessoesCobranca;
  }
  return estimarSessoesEsperadasMes(opts.frequenciaAtendimento);
}

export function calcularMetricaComparecimento(
  sessoes: SessaoSigla[],
  opts: {
    qtdSessoesCobranca?: number | null;
    frequenciaAtendimento?: string | null;
  },
): MetricaComparecimento {
  const realizadas = contarRealizadas(sessoes);
  const esperadas = resolverSessoesEsperadas(opts);
  const taxa = esperadas != null && esperadas > 0 ? Math.min(realizadas / esperadas, 1) : null;

  return {
    realizadas,
    esperadas,
    taxa,
    frequenciaLabel: opts.frequenciaAtendimento?.trim() || null,
  };
}

export function formatarTaxaComparecimento(taxa: number | null): string | null {
  if (taxa == null) return null;
  return `${Math.round(taxa * 100)}%`;
}

export function formatarResumoComparecimento(metrica: MetricaComparecimento): string {
  const taxa = formatarTaxaComparecimento(metrica.taxa);
  if (metrica.esperadas != null) {
    return taxa
      ? `${metrica.realizadas}/${metrica.esperadas} · ${taxa}`
      : `${metrica.realizadas}/${metrica.esperadas}`;
  }
  return `${metrica.realizadas} realizada${metrica.realizadas === 1 ? "" : "s"}`;
}
