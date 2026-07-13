import type { Cobranca } from "@/lib/queries/cobrancas";
import type { CobrancaStatus, PacienteTipo } from "@/lib/types";

export type StatusResumo = CobrancaStatus | "parcial";

export type PacienteCobrancaResumo = {
  pacienteId: string;
  pacienteNome: string;
  tipo: PacienteTipo;
  totalValor: number;
  qtdTotal: number;
  qtdPagas: number;
  progressoLabel: string;
  statusResumo: StatusResumo;
  cobrancas: Cobranca[];
};

const PENDENTES: CobrancaStatus[] = ["pendente", "aguardando_convenio", "aguardando_alvara"];
const VENCIDOS: CobrancaStatus[] = ["vencido", "atrasado"];

/** KPIs no mesmo critério do RPC financeiro_kpis (exclui cancelado). */
export function calcularKpisDeCobrancas(cobrancas: Cobranca[]): {
  total: number;
  pago: number;
  pendente: number;
  vencido: number;
} {
  let total = 0;
  let pago = 0;
  let pendente = 0;
  let vencido = 0;
  for (const c of cobrancas) {
    if (c.status === "cancelado") continue;
    total += c.valor;
    if (c.status === "pago") pago += c.valor;
    else if (PENDENTES.includes(c.status)) pendente += c.valor;
    else if (VENCIDOS.includes(c.status)) vencido += c.valor;
  }
  return { total, pago, pendente, vencido };
}

function statusResumoDe(ativas: Cobranca[]): StatusResumo {
  if (ativas.length === 0) return "pendente";
  const statuses = ativas.map((c) => c.status);
  if (statuses.every((s) => s === "pago")) return "pago";
  if (statuses.some((s) => VENCIDOS.includes(s))) return "vencido";
  const temPago = statuses.some((s) => s === "pago");
  const temPendente = statuses.some((s) => PENDENTES.includes(s) || s === "regularizar_retroativa");
  if (temPago && temPendente) return "parcial";
  if (temPendente) {
    if (statuses.every((s) => s === "aguardando_convenio")) return "aguardando_convenio";
    if (statuses.every((s) => s === "aguardando_alvara")) return "aguardando_alvara";
    if (statuses.every((s) => s === "regularizar_retroativa")) return "regularizar_retroativa";
    return "pendente";
  }
  return statuses[0] ?? "pendente";
}

/**
 * Agrega cobranças por paciente (1 linha na lista geral).
 * Canceladas entram no histórico do grupo, mas fora do total/progresso.
 */
export function agregarCobrancasPorPaciente(cobrancas: Cobranca[]): PacienteCobrancaResumo[] {
  const map = new Map<string, Cobranca[]>();
  for (const c of cobrancas) {
    const list = map.get(c.pacienteId) ?? [];
    list.push(c);
    map.set(c.pacienteId, list);
  }

  const result: PacienteCobrancaResumo[] = [];
  for (const [pacienteId, rows] of map) {
    const sorted = [...rows].sort((a, b) => {
      const ay = a.competenciaAno ?? 0;
      const by = b.competenciaAno ?? 0;
      if (ay !== by) return by - ay;
      const am = a.competenciaMes ?? 0;
      const bm = b.competenciaMes ?? 0;
      if (am !== bm) return bm - am;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const ativas = sorted.filter((c) => c.status !== "cancelado");
    const qtdPagas = ativas.filter((c) => c.status === "pago").length;
    const qtdTotal = ativas.length;
    const totalValor = ativas.reduce((sum, c) => sum + c.valor, 0);
    const recent = sorted[0];

    result.push({
      pacienteId,
      pacienteNome: recent?.pacienteNome ?? "—",
      tipo: recent?.tipo ?? "particular",
      totalValor,
      qtdTotal,
      qtdPagas,
      progressoLabel: `${qtdPagas} de ${qtdTotal}`,
      statusResumo: statusResumoDe(ativas),
      cobrancas: sorted,
    });
  }

  return result.sort((a, b) => a.pacienteNome.localeCompare(b.pacienteNome, "pt-BR"));
}
