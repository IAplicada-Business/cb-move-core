import { classificarSituacaoSessao } from "./plano-sessoes-mensal";
import type { SlotPlanoMensal } from "./padrao-agenda-mensal";

export type AgendamentoPlanoRef = {
  id: string;
  inicio: string;
  status: string;
};

export type SlotComAgendamento = {
  slot: SlotPlanoMensal;
  agendamento: AgendamentoPlanoRef | null;
};

export type ResultadoMapeamentoSlots = {
  slots: SlotComAgendamento[];
  faltantesSlots: SlotPlanoMensal[];
  extras: AgendamentoPlanoRef[];
};

/**
 * Casa agendamentos ativos aos slots do template (mesma data, ordem cronológica no dia).
 * Alinhado a filtrarSlotsFaltantes em padrao-agenda-mensal.ts.
 */
export function mapearAgendamentosAosSlots(
  slots: SlotPlanoMensal[],
  agendamentos: AgendamentoPlanoRef[],
): ResultadoMapeamentoSlots {
  const ativos = agendamentos.filter((ag) => classificarSituacaoSessao(ag.status) != null);

  const porData = new Map<string, AgendamentoPlanoRef[]>();
  for (const ag of [...ativos].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const data = ag.inicio.slice(0, 10);
    const lista = porData.get(data);
    if (lista) lista.push(ag);
    else porData.set(data, [ag]);
  }

  const consumidoPorData = new Map<string, number>();
  const matchedIds = new Set<string>();
  const slotsComAg: SlotComAgendamento[] = [];

  for (const slot of slots) {
    const pool = porData.get(slot.dataIso) ?? [];
    const usado = consumidoPorData.get(slot.dataIso) ?? 0;
    const agendamento = pool[usado] ?? null;
    if (agendamento) {
      consumidoPorData.set(slot.dataIso, usado + 1);
      matchedIds.add(agendamento.id);
    }
    slotsComAg.push({ slot, agendamento });
  }

  const faltantesSlots = slotsComAg.filter((s) => !s.agendamento).map((s) => s.slot);
  const extras = ativos.filter((ag) => !matchedIds.has(ag.id));

  return { slots: slotsComAg, faltantesSlots, extras };
}
