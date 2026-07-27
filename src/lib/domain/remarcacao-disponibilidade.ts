import {
  GRADE_SEMANA_PADRAO,
  agendamentoNoBloco,
  blocoDentroDisponibilidade,
  indisponibilidadeNoBloco,
  resolverSlotStatus,
  type SlotStatus,
} from "@/lib/domain/slot-status";
import type { FisioDisponibilidade, FisioIndisponibilidade } from "@/lib/queries/fisio-horarios";
import type { ResumoPlanoSessoesMensal } from "@/lib/domain/plano-sessoes-mensal";
import type { StatusAgendamento } from "@/lib/types";
import { isoToDDMMYY, isoToHHMM } from "@/lib/format";

export type BlocoRemarcacao = {
  dataIso: string;
  horaInicio: string;
  blocoFim: string;
  status: SlotStatus;
  selecionavel: boolean;
  pacienteNome?: string;
  motivoIndisponivel?: string;
};

export type SlotRemarcacaoSelecionado = {
  dataIso: string;
  horaInicio: string;
};

type AgendamentoMin = {
  id: string;
  fisioterapeuta_id: string | null;
  inicio: string;
  duracao_min: number;
  status?: StatusAgendamento;
  pacientes?: { nome: string } | null;
};

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Segunda=1 … Sexta=5 (convenção da clínica). */
export function diaSemanaClinica(dataIso: string): number {
  const wd = parseIsoDate(dataIso).getDay();
  return wd === 0 ? 7 : wd;
}

export function calcularSemanaDestino(dataIso: string): {
  inicio: string;
  fim: string;
  semanaBase: Date;
  diasUteis: Date[];
} {
  const anchor = parseIsoDate(dataIso);
  const semanaBase = startOfIsoWeek(anchor);
  const diasUteis = [1, 2, 3, 4, 5].map((offset) => addDays(semanaBase, offset - 1));
  const inicio = `${toDateIso(diasUteis[0])}T00:00:00-03:00`;
  const fim = `${toDateIso(diasUteis[4])}T23:59:59-03:00`;
  return { inicio, fim, semanaBase, diasUteis };
}

export function checarConflitoRemarcacao(opts: {
  fisioId: string;
  novoInicio: string;
  duracaoMin: number;
  agendamentos: AgendamentoMin[];
  excluirIds: Set<string>;
}): { ok: boolean; motivo?: string } {
  const novoIni = new Date(opts.novoInicio).getTime();
  const novoFim = novoIni + opts.duracaoMin * 60_000;

  for (const ag of opts.agendamentos) {
    if (opts.excluirIds.has(ag.id)) continue;
    if (ag.fisioterapeuta_id !== opts.fisioId) continue;
    if (ag.status === "cancelado" || ag.status === "remarcacao") continue;

    const agIni = new Date(ag.inicio).getTime();
    const agFim = agIni + (ag.duracao_min ?? 50) * 60_000;
    if (novoIni < agFim && novoFim > agIni) {
      return {
        ok: false,
        motivo: "Horário indisponível — já existe agendamento neste bloco.",
      };
    }
  }
  return { ok: true };
}

export function listarBlocosDia(opts: {
  fisioId: string;
  dataIso: string;
  disponibilidade: FisioDisponibilidade[];
  indisponibilidades: FisioIndisponibilidade[];
  agendamentos: AgendamentoMin[];
  excluirIds?: Set<string>;
}): BlocoRemarcacao[] {
  const day = parseIsoDate(opts.dataIso);
  const diaSemana = diaSemanaClinica(opts.dataIso);
  const blocos = GRADE_SEMANA_PADRAO.filter((r) => r.kind === "bloco");

  return blocos.map((row) => {
    const items = opts.agendamentos.filter(
      (ag) =>
        ag.fisioterapeuta_id === opts.fisioId &&
        !opts.excluirIds?.has(ag.id) &&
        ag.inicio.slice(0, 10) === opts.dataIso &&
        agendamentoNoBloco(ag.inicio, row.inicio, row.fim),
    );
    const first = items[0];
    const indisp = indisponibilidadeNoBloco(
      opts.indisponibilidades,
      day,
      row.inicio,
      row.fim,
      opts.fisioId,
    );
    const dentroDisp = blocoDentroDisponibilidade(
      opts.disponibilidade,
      opts.fisioId,
      diaSemana,
      row.inicio,
      row.fim,
    );
    const status = resolverSlotStatus({
      agendamentoStatus: first?.status,
      temAgendamento: items.length > 0,
      indisp,
      dentroDisp,
    });
    const selecionavel = status === "vago" || status === "extra";

    return {
      dataIso: opts.dataIso,
      horaInicio: row.inicio,
      blocoFim: row.fim,
      status,
      selecionavel,
      pacienteNome: first?.pacientes?.nome,
      motivoIndisponivel:
        status === "ocupado"
          ? "Horário indisponível — já ocupado."
          : status === "indisponivel" || status === "ferias"
            ? "Horário indisponível para este fisioterapeuta."
            : undefined,
    };
  });
}

export function avaliarDestinoRemarcacao(opts: {
  fisioId: string;
  dataIso: string;
  horaInicio: string;
  duracaoMin: number;
  novoInicio: string;
  disponibilidade: FisioDisponibilidade[];
  indisponibilidades: FisioIndisponibilidade[];
  agendamentos: AgendamentoMin[];
  excluirIds: Set<string>;
  datasPlano?: Set<string>;
}): {
  ok: boolean;
  alerta?: string;
  alertaTipo?: "erro" | "aviso";
  slotStatus?: SlotStatus;
} {
  const blocos = listarBlocosDia({
    fisioId: opts.fisioId,
    dataIso: opts.dataIso,
    disponibilidade: opts.disponibilidade,
    indisponibilidades: opts.indisponibilidades,
    agendamentos: opts.agendamentos,
    excluirIds: opts.excluirIds,
  });

  const bloco = blocos.find((b) => b.horaInicio === opts.horaInicio.slice(0, 5));
  if (bloco && !bloco.selecionavel) {
    return {
      ok: false,
      alerta: bloco.motivoIndisponivel ?? "Horário indisponível.",
      alertaTipo: "erro",
      slotStatus: bloco.status,
    };
  }

  const conflito = checarConflitoRemarcacao({
    fisioId: opts.fisioId,
    novoInicio: opts.novoInicio,
    duracaoMin: opts.duracaoMin,
    agendamentos: opts.agendamentos,
    excluirIds: opts.excluirIds,
  });
  if (!conflito.ok) {
    return { ok: false, alerta: conflito.motivo, alertaTipo: "erro", slotStatus: "ocupado" };
  }

  if (opts.datasPlano && opts.datasPlano.size > 0 && !opts.datasPlano.has(opts.dataIso)) {
    return {
      ok: true,
      alerta: "Data fora dos dias do plano contratual do paciente.",
      alertaTipo: "aviso",
      slotStatus: bloco?.status,
    };
  }

  const diaSemana = diaSemanaClinica(opts.dataIso);
  const temDispNoDia = opts.disponibilidade.some(
    (f) => f.fisioterapeuta_id === opts.fisioId && f.dia_semana === diaSemana && f.ativo,
  );
  if (opts.datasPlano?.has(opts.dataIso) && opts.disponibilidade.length > 0 && !temDispNoDia) {
    return {
      ok: true,
      alerta: "Este fisioterapeuta não tem disponibilidade cadastrada no dia do plano.",
      alertaTipo: "aviso",
      slotStatus: bloco?.status,
    };
  }

  return { ok: true, slotStatus: bloco?.status };
}

export function sugerirDatasPlano(resumo: ResumoPlanoSessoesMensal): string[] {
  const datas = new Set<string>();
  for (const slot of resumo.faltantesSlots) {
    if (slot.dataIso) datas.add(slot.dataIso);
  }
  for (const item of resumo.itens) {
    if (item.dataSlotIso) datas.add(item.dataSlotIso);
    else datas.add(item.inicio.slice(0, 10));
  }
  return [...datas].sort();
}

export function idsExcluirRemarcacao(
  agendamentoId: string,
  escopo: "pontual" | "semana" | "serie_mes",
  agendamentos: Array<{
    id: string;
    inicio: string;
    paciente_id: string | null;
    serie_id?: string | null;
  }>,
  origem: { id: string; inicio: string; paciente_id: string | null; serie_id?: string | null },
): Set<string> {
  if (escopo === "pontual") return new Set([agendamentoId]);

  const origemDate = new Date(origem.inicio);
  const fimMes = new Date(origemDate.getFullYear(), origemDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const ids = new Set<string>();
  for (const ag of agendamentos) {
    if (ag.paciente_id !== origem.paciente_id) continue;
    if (origem.serie_id && ag.serie_id !== origem.serie_id) continue;
    if (new Date(ag.inicio) < origemDate) continue;

    if (escopo === "semana") {
      if (startOfIsoWeek(new Date(ag.inicio)).getTime() !== startOfIsoWeek(origemDate).getTime())
        continue;
    } else if (escopo === "serie_mes") {
      if (new Date(ag.inicio) > fimMes) continue;
    }
    ids.add(ag.id);
  }
  return ids;
}

/** Segunda-feira da semana ISO seguinte ao horário de origem, mantendo a hora. */
export function defaultDestinoRemarcar(inicioIso: string): { data: string; horaInicio: string } {
  const origem = new Date(inicioIso);
  const day = origem.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const proximaSegunda = new Date(origem);
  proximaSegunda.setDate(origem.getDate() + diff + 7);
  proximaSegunda.setHours(0, 0, 0, 0);
  const y = proximaSegunda.getFullYear();
  const m = String(proximaSegunda.getMonth() + 1).padStart(2, "0");
  const d = String(proximaSegunda.getDate()).padStart(2, "0");
  return {
    data: isoToDDMMYY(`${y}-${m}-${d}`),
    horaInicio: isoToHHMM(inicioIso),
  };
}
