import type { FrequenciaSigla } from "@/lib/types";

export const SIGLAS_REALIZADAS: FrequenciaSigla[] = ["P", "RC"];

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
  const taxa =
    esperadas != null && esperadas > 0 ? Math.min(realizadas / esperadas, 1) : null;

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
