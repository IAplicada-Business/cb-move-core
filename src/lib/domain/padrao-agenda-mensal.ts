import { extrairMultiplicadorPlano } from "./frequencia";

/** Segunda=1 … Sexta=5 (convenção 2ª–6ª feira da clínica). */
export function parseDiasSemanaPt(texto: string | null | undefined): number[] {
  if (!texto?.trim()) return [];

  const normalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ª/g, "");

  const range = normalizado.match(/(\d)\s*a\s*(\d)/);
  if (range) {
    const ini = Number(range[1]);
    const fim = Number(range[2]);
    if (ini >= 2 && fim >= ini && fim <= 6) {
      return Array.from({ length: fim - ini + 1 }, (_, i) => ini - 1 + i);
    }
  }

  const dias = [...normalizado.matchAll(/\b([2-6])\b/g)]
    .map((m) => Number(m[1]))
    .map((d) => d - 1);

  return [...new Set(dias)].sort((a, b) => a - b);
}

/** Sessões por dia de atendimento (simples=1, duplo=2, triplo=3). */
export function sessoesPorVisita(
  diasSemana: string | null | undefined,
  frequenciaAtendimento: string | null | undefined,
): number {
  const texto = (diasSemana ?? frequenciaAtendimento ?? "").toLowerCase();
  if (texto.includes("triplo")) return 3;
  if (texto.includes("duplo")) return 2;
  return 1;
}

export type SlotPlanoMensal = {
  dataIso: string;
  indicePlano: number;
  sessaoNoDia: number;
};

function jsWeekdayFromIso(dataIso: string): number {
  const [y, m, d] = dataIso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isoFromDate(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Conta agendamentos existentes por data (YYYY-MM-DD). */
export function contarAgendamentosPorData(
  agendamentos: Array<{ inicio: string }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const ag of agendamentos) {
    const data = ag.inicio.slice(0, 10);
    map.set(data, (map.get(data) ?? 0) + 1);
  }
  return map;
}

/**
 * Gera slots esperados do plano no mês conforme dias da semana cadastrados.
 * Ex.: "2ª e 5ª (triplos)" + 24x → 2 dias × 3 sessões × 4 semanas.
 */
export function gerarSlotsPlanoMensal(opts: {
  mes: number;
  ano: number;
  quantidadeMensal: number;
  diasSemana: string | null | undefined;
  frequenciaAtendimento: string | null | undefined;
}): SlotPlanoMensal[] {
  const { mes, ano, quantidadeMensal } = opts;
  if (quantidadeMensal <= 0) return [];

  const diasPt = parseDiasSemanaPt(opts.diasSemana);
  if (diasPt.length === 0) return [];

  const porVisita = sessoesPorVisita(opts.diasSemana, opts.frequenciaAtendimento);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const slots: SlotPlanoMensal[] = [];

  for (let dia = 1; dia <= ultimoDia && slots.length < quantidadeMensal; dia++) {
    const dataIso = isoFromDate(ano, mes, dia);
    const wd = jsWeekdayFromIso(dataIso);
    if (!diasPt.includes(wd)) continue;

    for (let s = 1; s <= porVisita && slots.length < quantidadeMensal; s++) {
      slots.push({
        dataIso,
        indicePlano: slots.length + 1,
        sessaoNoDia: s,
      });
    }
  }

  return slots;
}

/** Slots do plano ainda sem agendamento suficiente na data. */
export function filtrarSlotsFaltantes(
  slots: SlotPlanoMensal[],
  agendamentosExistentes: Array<{ inicio: string }>,
): SlotPlanoMensal[] {
  const porData = contarAgendamentosPorData(agendamentosExistentes);
  const consumidoPorData = new Map<string, number>();

  return slots.filter((slot) => {
    const totalNaData = porData.get(slot.dataIso) ?? 0;
    const usado = consumidoPorData.get(slot.dataIso) ?? 0;
    if (usado >= totalNaData) return true;
    consumidoPorData.set(slot.dataIso, usado + 1);
    return false;
  });
}

/** Fallback: mesmo dia da semana da data âncora (fluxo anterior). */
export function gerarDatasMesmoDiaSemanaNoMes(dataInicioIso: string, quantidade: number): string[] {
  if (quantidade <= 0) return [];
  const match = dataInicioIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return [];

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const diaInicio = Number(match[3]);
  const weekday = new Date(ano, mes - 1, diaInicio).getDay();
  const ultimoDia = new Date(ano, mes, 0).getDate();

  const datas: string[] = [];
  for (let dia = diaInicio; dia <= ultimoDia && datas.length < quantidade; dia++) {
    if (new Date(ano, mes - 1, dia).getDay() === weekday) {
      datas.push(isoFromDate(ano, mes, dia));
    }
  }
  return datas;
}

export type PropostaAgendamentoPlano = {
  dataIso: string;
  horaInicio: string;
  indicePlano: number;
};

/** Monta propostas de horário (sessões múltiplas no mesmo dia são espaçadas pela duração). */
export function montarPropostasAgendamento(opts: {
  slots: SlotPlanoMensal[];
  horaBase: string;
  duracaoMin: number;
}): PropostaAgendamentoPlano[] {
  const { slots, horaBase, duracaoMin } = opts;
  const [hh, mm] = horaBase.split(":").map(Number);

  return slots.map((slot) => {
    const offsetMin = (slot.sessaoNoDia - 1) * duracaoMin;
    const totalMin = hh * 60 + mm + offsetMin;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const horaInicio = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { dataIso: slot.dataIso, horaInicio, indicePlano: slot.indicePlano };
  });
}

export function resolverVezesPorSemana(frequenciaAtendimento: string | null | undefined): number | null {
  const match = frequenciaAtendimento?.match(/(\d+)\s*x\s*semana/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function estimarDiasSemanaFromFrequencia(
  frequenciaAtendimento: string | null | undefined,
): number[] | null {
  const vezes = resolverVezesPorSemana(frequenciaAtendimento);
  if (!vezes) return null;
  if (vezes >= 5) return [1, 2, 3, 4, 5];
  if (vezes === 4) return [1, 2, 3, 4];
  if (vezes === 2) return [1, 4];
  if (vezes === 1) return [1];
  return null;
}

export function gerarSlotsFaltantesPlano(opts: {
  mes: number;
  ano: number;
  quantidadeMensal: number;
  diasSemana: string | null | undefined;
  frequenciaAtendimento: string | null | undefined;
  agendamentosExistentes: Array<{ inicio: string }>;
  dataAncoraIso?: string | null;
}): SlotPlanoMensal[] {
  let slots = gerarSlotsPlanoMensal(opts);
  if (slots.length === 0 && opts.dataAncoraIso && opts.quantidadeMensal > 0) {
    const datas = gerarDatasMesmoDiaSemanaNoMes(opts.dataAncoraIso, opts.quantidadeMensal);
    slots = datas.map((dataIso, i) => ({
      dataIso,
      indicePlano: i + 1,
      sessaoNoDia: 1,
    }));
  }
  return filtrarSlotsFaltantes(slots, opts.agendamentosExistentes);
}
