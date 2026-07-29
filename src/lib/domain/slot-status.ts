import type { FisioDisponibilidade, FisioIndisponibilidade } from "@/lib/queries/fisio-horarios";
import type { StatusAgendamento } from "@/lib/types";

export type GradeLinha =
  | { kind: "bloco"; inicio: string; fim: string; labelInicio: string; labelFim: string }
  | { kind: "intervalo"; inicio: string; fim: string; label: string };

export const GRADE_SEMANA_PADRAO: GradeLinha[] = [
  { kind: "bloco", inicio: "08:00", fim: "09:25", labelInicio: "08:00", labelFim: "09:25" },
  { kind: "bloco", inicio: "09:30", fim: "10:55", labelInicio: "09:30", labelFim: "10:55" },
  { kind: "intervalo", inicio: "10:55", fim: "11:10", label: "Intervalo · 10:55 — 11:10" },
  { kind: "bloco", inicio: "11:10", fim: "12:25", labelInicio: "11:10", labelFim: "12:25" },
  { kind: "intervalo", inicio: "12:25", fim: "12:40", label: "Intervalo · 12:25 — 12:40" },
  { kind: "bloco", inicio: "12:40", fim: "14:05", labelInicio: "12:40", labelFim: "14:05" },
  { kind: "bloco", inicio: "14:10", fim: "15:35", labelInicio: "14:10", labelFim: "15:35" },
  { kind: "bloco", inicio: "15:40", fim: "17:05", labelInicio: "15:40", labelFim: "17:05" },
  { kind: "intervalo", inicio: "17:05", fim: "17:20", label: "Intervalo · 17:05 — 17:20" },
  { kind: "bloco", inicio: "17:20", fim: "18:45", labelInicio: "17:20", labelFim: "18:45" },
  { kind: "bloco", inicio: "18:50", fim: "20:15", labelInicio: "18:50", labelFim: "20:15" },
];

export const BLOCOS_COUNT = GRADE_SEMANA_PADRAO.filter((r) => r.kind === "bloco").length;
export const INTERVALOS_COUNT = GRADE_SEMANA_PADRAO.filter((r) => r.kind === "intervalo").length;

/** Duração padrão da sessão CB MOVE — 1h25 (85 min), alinhada aos blocos da grade. */
export const SESSAO_DURACAO_MIN = 85;

export const SESSAO_DURACAO_OPCOES = [85, 60] as const;

/** Durações válidas no formulário — blocos da grade + exceção 1h; inclui valor atual se fora da lista. */
export function sessaoDuracaoOpcoes(valorAtual?: number): number[] {
  const fromGrade = GRADE_SEMANA_PADRAO.filter((r) => r.kind === "bloco").map((r) =>
    duracaoBlocoMin(r.inicio, r.fim),
  );
  const set = new Set([...fromGrade, 60]);
  if (valorAtual != null && valorAtual > 0) set.add(valorAtual);
  return [...set].sort((a, b) => b - a);
}

export function duracaoBlocoMin(blocoInicio: string, blocoFim: string): number {
  return timeToMinutes(blocoFim) - timeToMinutes(blocoInicio);
}

/** Rótulo amigável — 85 → "1h25". */
export function duracaoSessaoLabel(minutos: number): string {
  if (minutos === SESSAO_DURACAO_MIN) return "1h25";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${minutos}min`;
}

export function blocoDuracaoDefault(horaInicio: string): number {
  const row = GRADE_SEMANA_PADRAO.find((r) => r.kind === "bloco" && r.inicio === horaInicio);
  if (row?.kind === "bloco") return duracaoBlocoMin(row.inicio, row.fim);
  return SESSAO_DURACAO_MIN;
}

export function horarioSessaoLabel(
  inicioIso: string,
  duracaoMin: number = SESSAO_DURACAO_MIN,
): string {
  const startMin = isoWallClockMinutes(inicioIso);
  const endMin = startMin + duracaoMin;
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  return `${fmt(startMin)}–${fmt(endMin)} · ${duracaoSessaoLabel(duracaoMin)}`;
}

export type SlotStatus = "ocupado" | "vago" | "indisponivel" | "ferias" | "extra";

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function minutesOnDate(day: Date, hhmm: string) {
  const d = new Date(day);
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function isoWallClockMinutes(iso: string): number {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function agendamentoNoBloco(
  inicioIso: string,
  blocoInicio: string,
  blocoFim: string,
): boolean {
  const mins = isoWallClockMinutes(inicioIso);
  return mins >= timeToMinutes(blocoInicio) && mins < timeToMinutes(blocoFim);
}

export function indisponibilidadeNoBloco(
  items: FisioIndisponibilidade[],
  day: Date,
  blocoInicio: string,
  blocoFim: string,
  fisioterapeutaId: string,
): FisioIndisponibilidade | undefined {
  const start = minutesOnDate(day, blocoInicio);
  const end = minutesOnDate(day, blocoFim);
  return items.find((item) => {
    if (item.fisioterapeuta_id !== fisioterapeutaId) return false;
    const inicio = new Date(item.inicio);
    const fim = new Date(item.fim);
    return inicio < end && fim > start;
  });
}

export function blocoDentroDisponibilidade(
  faixas: FisioDisponibilidade[],
  fisioterapeutaId: string,
  diaSemana: number,
  blocoInicio: string,
  blocoFim: string,
): boolean | null {
  const doDia = faixas.filter(
    (f) => f.fisioterapeuta_id === fisioterapeutaId && f.dia_semana === diaSemana && f.ativo,
  );
  if (doDia.length === 0) return null;
  const b0 = timeToMinutes(blocoInicio);
  const b1 = timeToMinutes(blocoFim);
  return doDia.some((f) => {
    const a0 = timeToMinutes(String(f.hora_inicio));
    const a1 = timeToMinutes(String(f.hora_fim));
    return b0 >= a0 && b1 <= a1;
  });
}

export function resolverSlotStatus(opts: {
  agendamentoStatus?: StatusAgendamento | null;
  temAgendamento: boolean;
  indisp?: FisioIndisponibilidade;
  dentroDisp: boolean | null;
}): SlotStatus {
  if (opts.agendamentoStatus === "indisponivel") return "indisponivel";
  if (opts.agendamentoStatus === "ferias") return "ferias";
  if (opts.agendamentoStatus === "horario_extra") return "extra";
  if (opts.temAgendamento) return "ocupado";
  if (opts.indisp?.motivo === "ferias") return "ferias";
  if (opts.indisp) return "indisponivel";
  if (opts.dentroDisp === false) return "extra";
  return "vago";
}
