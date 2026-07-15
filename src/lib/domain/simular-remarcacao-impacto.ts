import { parseDiasSemanaPt } from "./padrao-agenda-mensal";
import { montarResumoPlanoSessoesMensal } from "./plano-sessoes-mensal";

export type EscopoRemarcacaoSimulacao = "pontual" | "semana" | "serie_mes";

export type AgendamentoRemarcacaoRef = {
  id: string;
  inicio: string;
  status: string;
  serie_id?: string | null;
};

export type PlanoRemarcacaoContext = {
  mes: number;
  ano: number;
  frequenciaLabel: string | null;
  diasSemanaLabel: string | null;
  qtdSessoesCobranca?: number | null;
};

export type MetricasPlanoImpacto = {
  noPadrao: number;
  faltantes: number;
  extras: number;
  pendentes: number;
};

export type ImpactoRemarcacao = {
  horariosAfetados: number;
  usaSlots: boolean;
  antes: MetricasPlanoImpacto;
  depois: MetricasPlanoImpacto;
  delta: {
    faltantes: number;
    extras: number;
    noPadrao: number;
    pendentes: number;
  };
  destinosForaDiasSemana: Array<{ dataIso: string; diaLabel: string }>;
  avisos: string[];
};

const STATUS_MOVE = ["agendado", "confirmado"] as const;

const NOMES_DIA_CLINICA = ["dom", "2ª", "3ª", "4ª", "5ª", "6ª", "sáb"] as const;

function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function sameIsoWeek(a: Date, b: Date): boolean {
  return startOfIsoWeek(a).getTime() === startOfIsoWeek(b).getTime();
}

function jsWeekdayFromIso(dataIso: string): number {
  const [y, m, d] = dataIso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function labelDiaClinica(dataIso: string): string {
  return NOMES_DIA_CLINICA[jsWeekdayFromIso(dataIso)];
}

function dataForaDiasSemana(dataIso: string, diasPt: number[]): boolean {
  if (diasPt.length === 0) return false;
  return !diasPt.includes(jsWeekdayFromIso(dataIso));
}

function shiftInicio(inicio: string, deltaMs: number): string {
  const d = new Date(inicio);
  d.setTime(d.getTime() + deltaMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-03:00`;
}

export function filtrarAfetadosRemarcacao(
  origem: AgendamentoRemarcacaoRef,
  agendamentos: AgendamentoRemarcacaoRef[],
  escopo: EscopoRemarcacaoSimulacao,
): AgendamentoRemarcacaoRef[] {
  if (escopo === "pontual") return [origem];

  const origemDate = new Date(origem.inicio);
  const fimMes = endOfMonth(origemDate);

  const filtrados = agendamentos.filter((ag) => {
    if (ag.id === origem.id) return true;
    const agDate = new Date(ag.inicio);
    if (agDate < origemDate) return false;
    if (!STATUS_MOVE.includes(ag.status as (typeof STATUS_MOVE)[number])) return false;
    if (origem.serie_id && ag.serie_id !== origem.serie_id) return false;
    if (escopo === "semana") return sameIsoWeek(agDate, origemDate);
    if (escopo === "serie_mes") return agDate <= fimMes;
    return false;
  });

  const map = new Map(filtrados.map((a) => [a.id, a]));
  map.set(origem.id, origem);
  return [...map.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function metricasFromResumo(resumo: ReturnType<typeof montarResumoPlanoSessoesMensal>): MetricasPlanoImpacto {
  return {
    noPadrao: resumo.agendadasNoPlano,
    faltantes: resumo.faltantes,
    extras: resumo.extras.length,
    pendentes: resumo.pendentes,
  };
}

function montarAvisos(input: {
  depois: MetricasPlanoImpacto;
  delta: ImpactoRemarcacao["delta"];
  destinosForaDiasSemana: ImpactoRemarcacao["destinosForaDiasSemana"];
  horariosAfetados: number;
  usaSlots: boolean;
  diasSemanaLabel: string | null;
}): string[] {
  const avisos: string[] = [];

  if (input.destinosForaDiasSemana.length > 0) {
    const datas = input.destinosForaDiasSemana
      .map((d) => `${d.dataIso.slice(8, 10)}/${d.dataIso.slice(5, 7)} (${d.diaLabel})`)
      .join(", ");
    avisos.push(
      input.horariosAfetados === 1
        ? `O destino cai fora dos dias do plano${input.diasSemanaLabel ? ` (${input.diasSemanaLabel})` : ""}: ${datas}.`
        : `${input.horariosAfetados} horário(s) cairão fora dos dias do plano${input.diasSemanaLabel ? ` (${input.diasSemanaLabel})` : ""}: ${datas}.`,
    );
  }

  if (input.usaSlots && input.delta.faltantes > 0) {
    avisos.push(
      input.delta.faltantes === 1
        ? "1 slot ficará vazio no padrão contratual."
        : `${input.delta.faltantes} slots ficarão vazios no padrão contratual.`,
    );
  }

  if (input.usaSlots && input.delta.extras > 0) {
    avisos.push(
      input.delta.extras === 1
        ? "1 horário ficará fora do padrão (extra)."
        : `${input.delta.extras} horários ficarão fora do padrão (extras).`,
    );
  }

  if (input.usaSlots) {
    avisos.push(
      `Plano após remarcação: ${input.depois.noPadrao} no padrão · ${input.depois.faltantes} faltante(s) · ${input.depois.extras} extra(s).`,
    );
  }

  return avisos;
}

export function simularRemarcacaoImpacto(input: {
  plano: PlanoRemarcacaoContext;
  agendamentos: AgendamentoRemarcacaoRef[];
  origem: AgendamentoRemarcacaoRef;
  novoInicio: string;
  escopo: EscopoRemarcacaoSimulacao;
}): ImpactoRemarcacao | null {
  const origemDate = new Date(input.origem.inicio);
  const destinoDate = new Date(input.novoInicio);
  if (Number.isNaN(origemDate.getTime()) || Number.isNaN(destinoDate.getTime())) return null;

  const deltaMs = destinoDate.getTime() - origemDate.getTime();
  if (deltaMs === 0) return null;

  const afetados = filtrarAfetadosRemarcacao(input.origem, input.agendamentos, input.escopo);
  const afetadosIds = new Set(afetados.map((a) => a.id));

  const agendamentosDepois = [
    ...input.agendamentos.filter((ag) => !afetadosIds.has(ag.id)),
    ...afetados.map((ag) => ({
      ...ag,
      inicio: shiftInicio(ag.inicio, deltaMs),
    })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));

  const planoBase = {
    mes: input.plano.mes,
    ano: input.plano.ano,
    frequenciaLabel: input.plano.frequenciaLabel,
    diasSemanaLabel: input.plano.diasSemanaLabel,
    qtdSessoesCobranca: input.plano.qtdSessoesCobranca,
  };

  const antesResumo = montarResumoPlanoSessoesMensal({
    ...planoBase,
    agendamentos: input.agendamentos,
  });
  const depoisResumo = montarResumoPlanoSessoesMensal({
    ...planoBase,
    agendamentos: agendamentosDepois,
  });

  const antes = metricasFromResumo(antesResumo);
  const depois = metricasFromResumo(depoisResumo);
  const delta = {
    faltantes: depois.faltantes - antes.faltantes,
    extras: depois.extras - antes.extras,
    noPadrao: depois.noPadrao - antes.noPadrao,
    pendentes: depois.pendentes - antes.pendentes,
  };

  const diasPt = parseDiasSemanaPt(input.plano.diasSemanaLabel);
  const usaSlots = diasPt.length > 0 && (input.plano.qtdSessoesCobranca ?? 0) > 0;

  const destinosUnicos = new Map<string, string>();
  for (const ag of afetados) {
    const dataNova = shiftInicio(ag.inicio, deltaMs).slice(0, 10);
    if (dataForaDiasSemana(dataNova, diasPt)) {
      destinosUnicos.set(dataNova, labelDiaClinica(dataNova));
    }
  }

  const destinosForaDiasSemana = [...destinosUnicos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dataIso, diaLabel]) => ({ dataIso, diaLabel }));

  const avisos = montarAvisos({
    depois,
    delta,
    destinosForaDiasSemana,
    horariosAfetados: afetados.length,
    usaSlots,
    diasSemanaLabel: input.plano.diasSemanaLabel,
  });

  return {
    horariosAfetados: afetados.length,
    usaSlots,
    antes,
    depois,
    delta,
    destinosForaDiasSemana,
    avisos,
  };
}
