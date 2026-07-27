import type { CobrancaStatus, RegimeCobranca } from "../types";
import { formatDate } from "../format";
import { resolverDiasSemanaExtrato, resolverFrequenciaExtrato } from "./atendimento-cadastro";

export type ExtratoFinanceiroLinha = {
  cobrancaId: string;
  pacienteId: string;
  pacienteNome: string;
  avaliacao: string | null;
  frequencia: string | null;
  diasSemana: string | null;
  numSessoes: number | null;
  plano: string;
  valorUnitario: number | null;
  valorPrevisto: number;
  valorRecebido: number | null;
  situacao: string;
};

export type ExtratoFinanceiroResumo = {
  competenciaMes: number;
  competenciaAno: number;
  linhas: ExtratoFinanceiroLinha[];
  totalPrevisto: number;
  totalRecebido: number;
  qtdLinhas: number;
};

export type ExtratoFinanceiroRawRow = {
  id: string;
  paciente_id: string;
  valor: number | string;
  status: CobrancaStatus;
  regime: RegimeCobranca | null;
  servico: string | null;
  observacoes: string | null;
  qtd_sessoes: number | null;
  frequencia_atendimento: string | null;
  dias_semana: string | null;
  pago_em: string | null;
  pacientes: {
    nome: string;
    criado_em: string | null;
    valor_mensal: number | null;
    valor_sessao: number | null;
    regime_cobranca: RegimeCobranca;
    frequencia_atendimento: string | null;
    dias_semana: string | null;
  } | null;
};

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function competenciaLabel(mes: number, ano: number) {
  const nome = MESES[mes - 1] ?? `Mês ${mes}`;
  return `${nome} ${ano}`;
}

export function formatPlano(regime: RegimeCobranca | null): string {
  if (regime === "por_sessao") return "Por Sessão";
  if (regime === "mensalista") return "Mensalista";
  return "—";
}

export function extrairSituacao(observacoes: string | null, status: CobrancaStatus): string {
  if (observacoes) {
    const migrado = observacoes.match(/migrado_logjur\s*\|\s*(.+)/i);
    if (migrado?.[1]) return migrado[1].trim();

    const retroativa = observacoes.match(/Retroativa detectada[^|]*\|\s*(.+)/i);
    if (retroativa?.[1]) return retroativa[1].trim();

    const trimmed = observacoes.trim();
    if (trimmed && !trimmed.startsWith("migrado_logjur")) return trimmed;
  }

  const labels: Record<CobrancaStatus, string> = {
    pago: "PAGO",
    pendente: "Pendente",
    atrasado: "Atrasado",
    vencido: "Vencido",
    aguardando_convenio: "Aguardando convênio",
    aguardando_alvara: "Aguardando alvará",
    regularizar_retroativa: "Regularizar retroativa",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

export function inferirFrequencia(servico: string | null): string | null {
  return resolverFrequenciaExtrato(null, null, servico);
}

function valorUnitario(
  regime: RegimeCobranca | null,
  paciente: ExtratoFinanceiroRawRow["pacientes"],
): number | null {
  if (!paciente) return null;
  if (regime === "mensalista" && paciente.valor_mensal != null)
    return Number(paciente.valor_mensal);
  if (regime === "por_sessao" && paciente.valor_sessao != null)
    return Number(paciente.valor_sessao);
  if (paciente.valor_mensal != null) return Number(paciente.valor_mensal);
  if (paciente.valor_sessao != null) return Number(paciente.valor_sessao);
  return null;
}

export function mapExtratoFinanceiroLinha(row: ExtratoFinanceiroRawRow): ExtratoFinanceiroLinha {
  const valor = Number(row.valor) || 0;
  const regime = row.regime ?? row.pacientes?.regime_cobranca ?? null;
  const pago = row.status === "pago";

  return {
    cobrancaId: row.id,
    pacienteId: row.paciente_id,
    pacienteNome: row.pacientes?.nome ?? "—",
    avaliacao: row.pacientes?.criado_em ? formatDate(row.pacientes.criado_em) : null,
    frequencia: resolverFrequenciaExtrato(
      row.frequencia_atendimento,
      row.pacientes?.frequencia_atendimento,
      row.servico,
    ),
    diasSemana: resolverDiasSemanaExtrato(row.dias_semana, row.pacientes?.dias_semana),
    numSessoes: row.qtd_sessoes,
    plano: formatPlano(regime),
    valorUnitario: valorUnitario(regime, row.pacientes),
    valorPrevisto: valor,
    valorRecebido: pago ? valor : null,
    situacao: extrairSituacao(row.observacoes, row.status),
  };
}

export function buildExtratoFinanceiro(
  rows: ExtratoFinanceiroRawRow[],
  mes: number,
  ano: number,
): ExtratoFinanceiroResumo {
  const linhas = rows
    .map(mapExtratoFinanceiroLinha)
    .sort((a, b) => a.pacienteNome.localeCompare(b.pacienteNome, "pt-BR"));

  const totalPrevisto = linhas.reduce((s, l) => s + l.valorPrevisto, 0);
  const totalRecebido = linhas.reduce((s, l) => s + (l.valorRecebido ?? 0), 0);

  return {
    competenciaMes: mes,
    competenciaAno: ano,
    linhas,
    totalPrevisto,
    totalRecebido,
    qtdLinhas: linhas.length,
  };
}

/** Formata número no padrão pt-BR (vírgula decimal) para abrir corretamente no Excel. */
function numeroBR(v: number | null | undefined): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function extratoToCsvRows(resumo: ExtratoFinanceiroResumo): Record<string, unknown>[] {
  const linhas = resumo.linhas.map((l) => ({
    "Nome do Paciente": l.pacienteNome,
    Avaliação: l.avaliacao ?? "",
    Frequência: l.frequencia ?? "",
    "Dias da Semana": l.diasSemana ?? "",
    "Nº Sessões": l.numSessoes ?? "",
    Plano: l.plano,
    "R$ Sessão/Mês": numeroBR(l.valorUnitario),
    "R$ Previsto": numeroBR(l.valorPrevisto),
    "R$ Recebido": numeroBR(l.valorRecebido),
    SITUAÇÃO: l.situacao,
  }));

  const totalRow = {
    "Nome do Paciente": "TOTAL",
    Avaliação: "",
    Frequência: "",
    "Dias da Semana": "",
    "Nº Sessões": "",
    Plano: "",
    "R$ Sessão/Mês": "",
    "R$ Previsto": numeroBR(resumo.totalPrevisto),
    "R$ Recebido": numeroBR(resumo.totalRecebido),
    SITUAÇÃO: "",
  };

  return [...linhas, totalRow];
}

const EXTRATO_COLUNAS = [
  "Nome do Paciente",
  "Avaliação",
  "Frequência",
  "Dias da Semana",
  "Nº Sessões",
  "Plano",
  "R$ Sessão/Mês",
  "R$ Previsto",
  "R$ Recebido",
  "SITUAÇÃO",
] as const;

/** Planilha XLSX alinhada à master financeira (mesmas colunas do CSV). */
export async function extratoToXlsxBlob(resumo: ExtratoFinanceiroResumo): Promise<Blob> {
  const XLSX = await import("xlsx");
  const rows = extratoToCsvRows(resumo);
  const aoa = [
    [...EXTRATO_COLUNAS],
    ...rows.map((row) => EXTRATO_COLUNAS.map((col) => String(row[col] ?? ""))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 36 },
  ];
  const wb = XLSX.utils.book_new();
  const sheetName = competenciaLabel(resumo.competenciaMes, resumo.competenciaAno)
    .replace(/[\\/?*[\]]/g, " ")
    .slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Extrato");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
