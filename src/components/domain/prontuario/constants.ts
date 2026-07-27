import type { FrequenciaSigla, ModeloRelatorio } from "@/lib/types";

export const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export const SIGLA_COLORS: Record<FrequenciaSigla, string> = {
  P: "bg-[#F7FEE7] text-cb-lime border-[#BEF264]",
  F: "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8]",
  FJ: "bg-[#FFF7ED] text-cb-orange border-[#FED7AA]",
  NJ: "bg-[#FFFBEB] text-yellow-700 border-[#FDE68A]",
  RC: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100",
  NR: "bg-muted text-muted-foreground border-border",
};

export function mesLabel(mes: number | null, ano: number | null) {
  if (!mes || !ano) return "—";
  return `${MESES_ABREV[mes - 1]}/${ano}`;
}
