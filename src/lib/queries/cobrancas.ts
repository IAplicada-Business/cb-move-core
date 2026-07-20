import { supabase } from "@/integrations/supabase/client";
import type { CobrancaStatus, FormaPagamento, PacienteTipo, RegimeCobranca } from "../types";

export type Cobranca = {
  id: string;
  pacienteId: string;
  pacienteNome: string | null;
  pacienteCpf: string | null;
  pacienteEmail: string | null;
  descricao: string | null;
  servico: string | null;
  valor: number;
  tipo: PacienteTipo;
  status: CobrancaStatus;
  regime: RegimeCobranca | null;
  formaPagamento: FormaPagamento | null;
  competenciaMes: number | null;
  competenciaAno: number | null;
  vencimento: string | null;
  pagoEm: string | null;
  boletoUrl: string | null;
  pixEmv: string | null;
  observacoes: string | null;
  frequenciaAtendimento: string | null;
  diasSemana: string | null;
  qtdSessoes: number | null;
  createdAt: string;
  parcelamentoGrupoId: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
};

type Row = {
  id: string;
  paciente_id: string;
  descricao: string | null;
  servico: string | null;
  valor: number | string;
  tipo: PacienteTipo;
  status: CobrancaStatus;
  regime: RegimeCobranca | null;
  forma_pagamento: FormaPagamento | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  vencimento: string | null;
  pago_em: string | null;
  boleto_url: string | null;
  pix_emv: string | null;
  observacoes: string | null;
  frequencia_atendimento: string | null;
  dias_semana: string | null;
  qtd_sessoes: number | null;
  created_at: string;
  parcelamento_grupo_id: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  pacientes?: { nome: string; cpf: string | null; email: string | null } | null;
};

const map = (r: Row): Cobranca => ({
  id: r.id,
  pacienteId: r.paciente_id,
  pacienteNome: r.pacientes?.nome ?? null,
  pacienteCpf: r.pacientes?.cpf ?? null,
  pacienteEmail: r.pacientes?.email ?? null,
  descricao: r.descricao,
  servico: r.servico,
  valor: Number(r.valor) || 0,
  tipo: r.tipo,
  status: r.status,
  regime: r.regime,
  formaPagamento: r.forma_pagamento,
  competenciaMes: r.competencia_mes,
  competenciaAno: r.competencia_ano,
  vencimento: r.vencimento,
  pagoEm: r.pago_em,
  boletoUrl: r.boleto_url,
  pixEmv: r.pix_emv,
  observacoes: r.observacoes,
  frequenciaAtendimento: r.frequencia_atendimento,
  diasSemana: r.dias_semana,
  qtdSessoes: r.qtd_sessoes,
  createdAt: r.created_at,
  parcelamentoGrupoId: r.parcelamento_grupo_id,
  parcelaNumero: r.parcela_numero,
  parcelaTotal: r.parcela_total,
});

export async function fetchRecentCobrancas(limit = 10): Promise<Cobranca[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, pacientes(nome, cpf, email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(map);
}

export async function fetchAllCobrancas(): Promise<Cobranca[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, pacientes(nome, cpf, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(map);
}

export async function fetchCobrancas(filters?: {
  competenciaMes?: number;
  competenciaAno?: number;
  status?: CobrancaStatus;
  tipo?: PacienteTipo;
  formaPagamento?: FormaPagamento;
  pacienteId?: string;
  search?: string;
}): Promise<Cobranca[]> {
  let query = supabase
    .from("cobrancas")
    .select("*, pacientes(nome, cpf, email)")
    .order("created_at", { ascending: false });

  if (filters?.competenciaMes) query = query.eq("competencia_mes", filters.competenciaMes);
  if (filters?.competenciaAno) query = query.eq("competencia_ano", filters.competenciaAno);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.tipo) query = query.eq("tipo", filters.tipo);
  if (filters?.formaPagamento) query = query.eq("forma_pagamento", filters.formaPagamento);
  if (filters?.pacienteId) query = query.eq("paciente_id", filters.pacienteId);

  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Row[]).map(map);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return rows.filter((c) => c.pacienteNome?.toLowerCase().includes(q));
  }
  return rows;
}

export async function createCobranca(input: {
  pacienteId: string;
  tipo: PacienteTipo;
  regime?: RegimeCobranca;
  servico: string;
  valor: number;
  formaPagamento: FormaPagamento;
  vencimento: string;
  competenciaMes?: number;
  competenciaAno?: number;
  qtdSessoes?: number;
  frequenciaAtendimento?: string;
  diasSemana?: string;
  observacoes?: string;
  parcelamentoGrupoId?: string;
  parcelaNumero?: number;
  parcelaTotal?: number;
}): Promise<Cobranca> {
  const { data, error } = await supabase
    .from("cobrancas")
    .insert({
      paciente_id: input.pacienteId,
      tipo: input.tipo,
      regime: input.regime,
      servico: input.servico,
      valor: input.valor,
      forma_pagamento: input.formaPagamento,
      vencimento: input.vencimento,
      competencia_mes: input.competenciaMes,
      competencia_ano: input.competenciaAno,
      qtd_sessoes: input.qtdSessoes,
      frequencia_atendimento: input.frequenciaAtendimento || null,
      dias_semana: input.diasSemana || null,
      observacoes: input.observacoes,
      parcelamento_grupo_id: input.parcelamentoGrupoId,
      parcela_numero: input.parcelaNumero,
      parcela_total: input.parcelaTotal,
    })
    .select("*, pacientes(nome, cpf, email)")
    .single();
  if (error) throw error;
  return map(data as unknown as Row);
}

export async function updateCobranca(id: string, input: Partial<{
  status: CobrancaStatus;
  pagoEm: string;
  boletoUrl: string;
  coraInvoiceId: string;
  pixEmv: string;
  formaPagamento: FormaPagamento;
  vencimento: string;
  observacoes: string;
  frequenciaAtendimento: string | null;
  diasSemana: string | null;
  qtdSessoes: number | null;
}>): Promise<void> {
  const patch: {
    status?: CobrancaStatus;
    pago_em?: string;
    boleto_url?: string;
    cora_invoice_id?: string;
    pix_emv?: string;
    forma_pagamento?: FormaPagamento;
    vencimento?: string;
    observacoes?: string;
    frequencia_atendimento?: string | null;
    dias_semana?: string | null;
    qtd_sessoes?: number | null;
  } = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.pagoEm !== undefined) patch.pago_em = input.pagoEm;
  if (input.boletoUrl !== undefined) patch.boleto_url = input.boletoUrl;
  if (input.coraInvoiceId !== undefined) patch.cora_invoice_id = input.coraInvoiceId;
  if (input.pixEmv !== undefined) patch.pix_emv = input.pixEmv;
  if (input.formaPagamento !== undefined) patch.forma_pagamento = input.formaPagamento;
  if (input.vencimento !== undefined) patch.vencimento = input.vencimento;
  if (input.observacoes !== undefined) patch.observacoes = input.observacoes;
  if (input.frequenciaAtendimento !== undefined) patch.frequencia_atendimento = input.frequenciaAtendimento;
  if (input.diasSemana !== undefined) patch.dias_semana = input.diasSemana;
  if (input.qtdSessoes !== undefined) patch.qtd_sessoes = input.qtdSessoes;

  const { error } = await supabase.from("cobrancas").update(patch).eq("id", id);
  if (error) throw error;
}

export async function marcarComoPago(id: string, pagoEm: string): Promise<void> {
  const { error } = await supabase
    .from("cobrancas")
    .update({ status: "pago", pago_em: pagoEm })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Divide um valor recebido fora do fluxo de boleto (depósito/PIX/alvará
 * judicial) em N cobranças mensais futuras. Usado quando o valor recebido
 * cobre vários meses de tratamento de uma vez (ex.: alvará judicial).
 */
export async function parcelarCobranca(input: {
  cobrancaOriginal: Cobranca;
  valorTotal: number;
  numeroParcelas: number;
  competenciaInicialMes: number;
  competenciaInicialAno: number;
  cancelarOriginal: boolean;
}): Promise<Cobranca[]> {
  const { cobrancaOriginal: orig, valorTotal, numeroParcelas, cancelarOriginal } = input;
  if (numeroParcelas < 2) throw new Error("Informe ao menos 2 parcelas");

  const grupoId = crypto.randomUUID();
  const baseCentavos = Math.round((valorTotal * 100) / numeroParcelas);
  const totalCentavos = Math.round(valorTotal * 100);
  const diaVencimento = orig.vencimento ? new Date(orig.vencimento).getDate() : 10;

  const criadas: Cobranca[] = [];
  let acumuladoCentavos = 0;
  for (let i = 0; i < numeroParcelas; i++) {
    const isUltima = i === numeroParcelas - 1;
    const valorCentavos = isUltima ? totalCentavos - acumuladoCentavos : baseCentavos;
    acumuladoCentavos += valorCentavos;

    const dataComp = new Date(input.competenciaInicialAno, input.competenciaInicialMes - 1 + i, 1);
    const mes = dataComp.getMonth() + 1;
    const ano = dataComp.getFullYear();
    const ultimoDiaMes = new Date(ano, mes, 0).getDate();
    const vencimento = new Date(ano, mes - 1, Math.min(diaVencimento, ultimoDiaMes))
      .toISOString()
      .split("T")[0];

    const cobranca = await createCobranca({
      pacienteId: orig.pacienteId,
      tipo: orig.tipo,
      regime: orig.regime ?? undefined,
      servico: orig.servico ?? "Fisioterapia",
      valor: valorCentavos / 100,
      formaPagamento: orig.formaPagamento ?? "deposito",
      vencimento,
      competenciaMes: mes,
      competenciaAno: ano,
      frequenciaAtendimento: orig.frequenciaAtendimento ?? undefined,
      diasSemana: orig.diasSemana ?? undefined,
      observacoes: `Parcela ${i + 1}/${numeroParcelas} — valor recebido via ${orig.formaPagamento ?? "depósito"} em ${orig.competenciaMes ?? ""}/${orig.competenciaAno ?? ""}.`,
      parcelamentoGrupoId: grupoId,
      parcelaNumero: i + 1,
      parcelaTotal: numeroParcelas,
    });
    criadas.push(cobranca);
  }

  if (cancelarOriginal) {
    await updateCobranca(orig.id, {
      status: "cancelado",
      observacoes: `${orig.observacoes ? orig.observacoes + " — " : ""}Substituída por parcelamento em ${numeroParcelas}x (grupo ${grupoId.slice(0, 8)}).`,
    });
  }

  return criadas;
}
