import { resolverSessoesEsperadas } from "./frequencia";

import { gerarSlotsPlanoMensal, parseDiasSemanaPt } from "./padrao-agenda-mensal";

import { mapearAgendamentosAosSlots } from "./plano-slot-matching";

import type { SlotPlanoMensal } from "./padrao-agenda-mensal";

export type SituacaoSessaoMensal = "concluida" | "pendente" | "faltou";

export type ItemSessaoMensal = {
  id: string;

  inicio: string;

  status: string;

  situacao: SituacaoSessaoMensal;

  semanaNoMes: number;

  dentroDoPlano: boolean;

  indicePlano?: number;

  dataSlotIso?: string;
};

export type ResumoPlanoSessoesMensal = {
  mes: number;

  ano: number;

  frequenciaLabel: string | null;

  diasSemanaLabel: string | null;

  quantidadeMensal: number | null;

  quantidadeExibicao: string;

  concluidas: number;

  pendentes: number;

  faltas: number;

  faltantes: number;

  agendadasNoPlano: number;

  itens: ItemSessaoMensal[];

  extras: ItemSessaoMensal[];

  faltantesSlots: SlotPlanoMensal[];

  agendamentosInicioMes: string[];
};

export function formatPlanoQuantidadeMensal(quantidadeMensal: number | null): string {
  if (quantidadeMensal != null && quantidadeMensal > 0) return `${quantidadeMensal}x`;

  return "—";
}

/** Datas ISO (YYYY-MM-DD) no mesmo dia da semana, a partir da data inicial até o fim do mês. */

export { gerarDatasMesmoDiaSemanaNoMes } from "./padrao-agenda-mensal";

export function classificarSituacaoSessao(status: string): SituacaoSessaoMensal | null {
  if (status === "realizado") return "concluida";

  if (status === "faltou") return "faltou";

  if (status === "agendado" || status === "confirmado") return "pendente";

  return null;
}

export function semanaNoMes(inicioIso: string): number {
  const d = new Date(inicioIso);

  const primeiroDia = new Date(d.getFullYear(), d.getMonth(), 1);

  return Math.ceil((d.getDate() + primeiroDia.getDay()) / 7);
}

export const SITUACAO_SESSAO_LABEL: Record<SituacaoSessaoMensal, string> = {
  concluida: "Concluída",

  pendente: "Pendente",

  faltou: "Faltou",
};

function mapearAgendamento(
  ag: { id: string; inicio: string; status: string },

  dentroDoPlano: boolean,

  meta?: { indicePlano: number; dataSlotIso: string },
): ItemSessaoMensal | null {
  const situacao = classificarSituacaoSessao(ag.status);

  if (!situacao) return null;

  return {
    id: ag.id,

    inicio: ag.inicio,

    status: ag.status,

    situacao,

    semanaNoMes: semanaNoMes(ag.inicio),

    dentroDoPlano,

    indicePlano: meta?.indicePlano,

    dataSlotIso: meta?.dataSlotIso,
  };
}

function montarResumoCronologico(
  input: {
    mes: number;

    ano: number;

    frequenciaLabel: string | null;

    diasSemanaLabel?: string | null;

    agendamentos: Array<{ id: string; inicio: string; status: string }>;
  },

  quantidadeMensal: number | null,
): Pick<
  ResumoPlanoSessoesMensal,
  | "itens"
  | "extras"
  | "faltantes"
  | "agendadasNoPlano"
  | "concluidas"
  | "pendentes"
  | "faltas"
  | "faltantesSlots"
> {
  const ordenados = input.agendamentos

    .map((ag) => mapearAgendamento(ag, true))

    .filter((item): item is ItemSessaoMensal => item != null)

    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

  const cota =
    quantidadeMensal != null && quantidadeMensal > 0 ? quantidadeMensal : ordenados.length;

  const itens = ordenados.slice(0, cota).map((item) => ({ ...item, dentroDoPlano: true }));

  const extras = ordenados.slice(cota).map((item) => ({ ...item, dentroDoPlano: false }));

  const concluidas = itens.filter((i) => i.situacao === "concluida").length;

  const pendentes = itens.filter((i) => i.situacao === "pendente").length;

  const faltas = itens.filter((i) => i.situacao === "faltou").length;

  const agendadasNoPlano = itens.length;

  const faltantes =
    quantidadeMensal != null && quantidadeMensal > 0
      ? Math.max(0, quantidadeMensal - agendadasNoPlano)
      : 0;

  return {
    itens,

    extras,

    faltantes,

    agendadasNoPlano,

    concluidas,

    pendentes,

    faltas,

    faltantesSlots: [],
  };
}

function montarResumoPorSlots(
  input: {
    mes: number;

    ano: number;

    frequenciaLabel: string | null;

    diasSemanaLabel?: string | null;

    agendamentos: Array<{ id: string; inicio: string; status: string }>;
  },

  quantidadeMensal: number,
): Pick<
  ResumoPlanoSessoesMensal,
  | "itens"
  | "extras"
  | "faltantes"
  | "agendadasNoPlano"
  | "concluidas"
  | "pendentes"
  | "faltas"
  | "faltantesSlots"
> {
  const slots = gerarSlotsPlanoMensal({
    mes: input.mes,

    ano: input.ano,

    quantidadeMensal,

    diasSemana: input.diasSemanaLabel,

    frequenciaAtendimento: input.frequenciaLabel,
  });

  const {
    slots: casados,
    faltantesSlots,
    extras: extrasAg,
  } = mapearAgendamentosAosSlots(
    slots,

    input.agendamentos,
  );

  const itens = casados

    .filter((c) => c.agendamento != null)

    .map((c) =>
      mapearAgendamento(c.agendamento!, true, {
        indicePlano: c.slot.indicePlano,

        dataSlotIso: c.slot.dataIso,
      }),
    )

    .filter((item): item is ItemSessaoMensal => item != null);

  const extras = extrasAg

    .map((ag) => mapearAgendamento(ag, false))

    .filter((item): item is ItemSessaoMensal => item != null);

  const concluidas = itens.filter((i) => i.situacao === "concluida").length;

  const pendentes = itens.filter((i) => i.situacao === "pendente").length;

  const faltas = itens.filter((i) => i.situacao === "faltou").length;

  return {
    itens,

    extras,

    faltantes: faltantesSlots.length,

    agendadasNoPlano: itens.length,

    concluidas,

    pendentes,

    faltas,

    faltantesSlots,
  };
}

export function montarResumoPlanoSessoesMensal(input: {
  mes: number;

  ano: number;

  frequenciaLabel: string | null;

  diasSemanaLabel?: string | null;

  qtdSessoesCobranca?: number | null;

  agendamentos: Array<{ id: string; inicio: string; status: string }>;
}): ResumoPlanoSessoesMensal {
  const quantidadeMensal = resolverSessoesEsperadas({
    qtdSessoesCobranca: input.qtdSessoesCobranca,

    frequenciaAtendimento: input.frequenciaLabel,
  });

  const diasPt = parseDiasSemanaPt(input.diasSemanaLabel);

  const usarSlots = diasPt.length > 0 && quantidadeMensal != null && quantidadeMensal > 0;

  const resumo = usarSlots
    ? montarResumoPorSlots(input, quantidadeMensal)
    : montarResumoCronologico(input, quantidadeMensal);

  return {
    mes: input.mes,

    ano: input.ano,

    frequenciaLabel: input.frequenciaLabel,

    diasSemanaLabel: input.diasSemanaLabel ?? null,

    quantidadeMensal,

    quantidadeExibicao: formatPlanoQuantidadeMensal(quantidadeMensal),

    ...resumo,

    agendamentosInicioMes: input.agendamentos.map((a) => a.inicio),
  };
}
