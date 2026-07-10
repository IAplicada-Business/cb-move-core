import type { PacienteTipo, FrequenciaSigla } from "@/lib/types";
import type { SessaoProntuario } from "@/lib/queries/prontuario";

const DIAS_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
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
}): "assinada" | "rascunho" {
  const completa = Boolean(ev.subjetivo?.trim() && ev.objetivo?.trim() && ev.plano?.trim());
  if (completa) return "assinada";
  if (ev.transcricao_raw?.trim() || ev.subjetivo || ev.objetivo || ev.plano) return "rascunho";
  return "rascunho";
}

export function countSessoesRealizadas(sessoes: SessaoProntuario[]): number {
  return sessoes.filter((s) => s.sigla === "P" || s.sigla === "RC").length;
}

export function countEvolucoesMes(
  evolucoes: { data: string }[],
  mes: number,
  ano: number,
): number {
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
