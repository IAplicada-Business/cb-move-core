import type { PacienteTipo } from "@/lib/types";
import { brl } from "@/lib/format";

/** Hex + Tailwind — single source of truth for charts and metric bars. */
export const CHART_TIPO_HEX = {
  particular: "#3FB5BC",
  judicial: "#D946A0",
  convenio: "#7B4FB5",
  puc: "#F58A1F",
} as const satisfies Record<PacienteTipo, string>;

export const CHART_TIPO_CONFIG = {
  particular: { label: "Particular", color: CHART_TIPO_HEX.particular },
  judicial: { label: "Judicial", color: CHART_TIPO_HEX.judicial },
  convenio: { label: "Convênio", color: CHART_TIPO_HEX.convenio },
  puc: { label: "PUC", color: CHART_TIPO_HEX.puc },
} as const;

export const TIPO_BAR_COLORS = {
  particular: "bg-cb-cyan-600",
  judicial: "bg-cb-magenta",
  convenio: "bg-cb-purple",
  puc: "bg-cb-orange",
} as const satisfies Record<PacienteTipo, string>;

export const CHART_STATUS_HEX = {
  pago: "#C5D932",
  pendente: "#F58A1F",
  vencido: "#D946A0",
  recebido: "#C5D932",
  emAberto: "#F58A1F",
} as const;

export const CHART_STATUS_BAR = {
  pago: "bg-cb-lime",
  pendente: "bg-cb-orange",
  vencido: "bg-cb-magenta",
} as const;

export const STACK_KEYS = ["puc", "convenio", "judicial", "particular"] as const;

export type ChartTipoKey = keyof typeof CHART_TIPO_CONFIG;

/** Formata valores monetários no eixo Y — compacto para k/M. */
export function formatChartAxisValue(value: number, { withCurrencyPrefix = false } = {}) {
  const prefix = withCurrencyPrefix ? "R$ " : "";
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${prefix}${Math.round(value / 1_000)}k`;
  return brl(value);
}
