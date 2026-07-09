/** Exemplos alinhados ao Relatório Financeiro 2026 da clínica */
export const FREQUENCIA_ATENDIMENTO_EXEMPLOS = [
  "1x semana simples",
  "2x semana simples",
  "2x semana duplo",
  "2x semana triplo",
  "4x semana simples",
  "5x semana duplo",
] as const;

export const DIAS_SEMANA_EXEMPLOS = [
  "2ª (Simples)",
  "3ª (Simples)",
  "2ª e 5ª (simples)",
  "2ª e 5ª (triplos)",
  "3ª, 4ª, 5ª e 6ª (simples)",
  "2ª a 6ª (duplos)",
] as const;

export function resolverFrequenciaExtrato(
  cobranca: string | null | undefined,
  paciente: string | null | undefined,
  servico: string | null | undefined,
): string | null {
  const trimmed = cobranca?.trim() || paciente?.trim();
  if (trimmed) return trimmed;
  if (!servico) return null;
  const s = servico.toLowerCase();
  if (s.includes("triplo")) return "Plano triplo";
  if (s.includes("duplo")) return "Plano duplo";
  if (s.includes("simples")) return "Plano simples";
  return null;
}

export function resolverDiasSemanaExtrato(
  cobranca: string | null | undefined,
  paciente: string | null | undefined,
): string | null {
  const trimmed = cobranca?.trim() || paciente?.trim();
  return trimmed || null;
}
