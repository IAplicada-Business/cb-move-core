import { supabase } from "@/integrations/supabase/client";
import type { CobrancaStatus, FormaPagamento, PacienteTipo, RegimeCobranca } from "../types";

export type Cobranca = {
  id: string;
  pacienteId: string;
  pacienteNome: string | null;
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
  observacoes: string | null;
  createdAt: string;
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
  observacoes: string | null;
  created_at: string;
  pacientes?: { nome: string } | null;
};

const map = (r: Row): Cobranca => ({
  id: r.id,
  pacienteId: r.paciente_id,
  pacienteNome: r.pacientes?.nome ?? null,
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
  observacoes: r.observacoes,
  createdAt: r.created_at,
});

export async function fetchRecentCobrancas(limit = 10): Promise<Cobranca[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, pacientes(nome)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(map);
}

export async function fetchAllCobrancas(): Promise<Cobranca[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, pacientes(nome)")
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
  search?: string;
}): Promise<Cobranca[]> {
  let query = supabase
    .from("cobrancas")
    .select("*, pacientes(nome)")
    .order("created_at", { ascending: false });

  if (filters?.competenciaMes) query = query.eq("competencia_mes", filters.competenciaMes);
  if (filters?.competenciaAno) query = query.eq("competencia_ano", filters.competenciaAno);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.tipo) query = query.eq("tipo", filters.tipo);
  if (filters?.formaPagamento) query = query.eq("forma_pagamento", filters.formaPagamento);

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
  observacoes?: string;
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
      observacoes: input.observacoes,
    })
    .select("*, pacientes(nome)")
    .single();
  if (error) throw error;
  return map(data as unknown as Row);
}

export async function updateCobranca(id: string, input: Partial<{
  status: CobrancaStatus;
  pagoEm: string;
  boletoUrl: string;
  coraInvoiceId: string;
  observacoes: string;
}>): Promise<void> {
  const { error } = await supabase
    .from("cobrancas")
    .update({
      status: input.status,
      pago_em: input.pagoEm,
      boleto_url: input.boletoUrl,
      cora_invoice_id: input.coraInvoiceId,
      observacoes: input.observacoes,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarComoPago(id: string, pagoEm: string): Promise<void> {
  const { error } = await supabase
    .from("cobrancas")
    .update({ status: "pago", pago_em: pagoEm })
    .eq("id", id);
  if (error) throw error;
}
