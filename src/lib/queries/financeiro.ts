import { supabase } from "@/integrations/supabase/client";
import type { CobrancaStatus, PacienteTipo } from "../types";

export type FinanceiroKpis = {
  total: number;
  pago: number;
  pendente: number;
  vencido: number;
  qtdTotal: number;
  qtdPago: number;
  qtdPendente: number;
  qtdVencido: number;
};

export type KpiPorTipo = {
  tipo: PacienteTipo;
  valor: number;
  pacientes: number;
};

export type ReceitaConvenioRow = {
  convenio: string;
  pacientes: number;
  sessoes: number;
  nfsEmitidas: number;
  faturado: number;
  recebido: number;
};

export type DestinatarioNf = {
  cobrancaId: string;
  pacienteId: string;
  pacienteNome: string;
  tipo: PacienteTipo;
  valor: number;
  competenciaMes: number | null;
  competenciaAno: number | null;
  destinatarioNome: string;
  destinatarioDocumento: string | null;
  corpoPacienteNome?: string | null;
  corpoPacienteCpf?: string | null;
  corpoNumeroProcesso?: string | null;
  corpoTotalSessoes?: number | null;
  templateCodigo?: string | null;
};

export type CobrancaSemNf = {
  cobrancaId: string;
  pacienteId: string;
  pacienteNome: string;
  tipo: PacienteTipo;
  valor: number;
  competenciaMes: number | null;
  competenciaAno: number | null;
  destinatarioNome: string | null;
  destinatarioDocumento: string | null;
  status: CobrancaStatus;
};

type KpisRow = {
  total: number | string;
  pago: number | string;
  pendente: number | string;
  vencido: number | string;
  qtd_total: number;
  qtd_pago: number;
  qtd_pendente: number;
  qtd_vencido: number;
};

export async function fetchFinanceiroKpis(mes: number, ano: number): Promise<FinanceiroKpis> {
  const { data, error } = await supabase.rpc("financeiro_kpis", { p_mes: mes, p_ano: ano });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as KpisRow | null;
  return {
    total: Number(row?.total) || 0,
    pago: Number(row?.pago) || 0,
    pendente: Number(row?.pendente) || 0,
    vencido: Number(row?.vencido) || 0,
    qtdTotal: Number(row?.qtd_total) || 0,
    qtdPago: Number(row?.qtd_pago) || 0,
    qtdPendente: Number(row?.qtd_pendente) || 0,
    qtdVencido: Number(row?.qtd_vencido) || 0,
  };
}

export async function fetchFinanceiroKpisPorTipo(mes: number, ano: number): Promise<KpiPorTipo[]> {
  const { data, error } = await supabase.rpc("financeiro_kpis_por_tipo", { p_mes: mes, p_ano: ano });
  if (error) throw error;
  return ((data ?? []) as { tipo: PacienteTipo; valor: number | string; pacientes: number }[]).map((r) => ({
    tipo: r.tipo,
    valor: Number(r.valor) || 0,
    pacientes: Number(r.pacientes) || 0,
  }));
}

export async function fetchRelatorioReceitaConvenio(mes: number, ano: number): Promise<ReceitaConvenioRow[]> {
  const { data, error } = await supabase.rpc("relatorio_receita_convenio", { p_mes: mes, p_ano: ano });
  if (error) throw error;
  return ((data ?? []) as {
    convenio: string;
    pacientes: number;
    sessoes: number;
    nfs_emitidas: number;
    faturado: number | string;
    recebido: number | string;
  }[]).map((r) => ({
    convenio: r.convenio,
    pacientes: Number(r.pacientes) || 0,
    sessoes: Number(r.sessoes) || 0,
    nfsEmitidas: Number(r.nfs_emitidas) || 0,
    faturado: Number(r.faturado) || 0,
    recebido: Number(r.recebido) || 0,
  }));
}

export async function resolverDestinatarioNf(cobrancaId: string): Promise<DestinatarioNf> {
  const { data, error } = await supabase.rpc("resolver_destinatario_nf", { p_cobranca_id: cobrancaId });
  if (error) throw error;
  const r = data as Record<string, unknown>;
  return {
    cobrancaId: String(r.cobranca_id),
    pacienteId: String(r.paciente_id),
    pacienteNome: String(r.paciente_nome ?? ""),
    tipo: r.tipo as PacienteTipo,
    valor: Number(r.valor) || 0,
    competenciaMes: r.competencia_mes != null ? Number(r.competencia_mes) : null,
    competenciaAno: r.competencia_ano != null ? Number(r.competencia_ano) : null,
    destinatarioNome: String(r.destinatario_nome ?? ""),
    destinatarioDocumento: r.destinatario_documento != null ? String(r.destinatario_documento) : null,
    corpoPacienteNome: r.corpo_paciente_nome != null ? String(r.corpo_paciente_nome) : null,
    corpoPacienteCpf: r.corpo_paciente_cpf != null ? String(r.corpo_paciente_cpf) : null,
    corpoNumeroProcesso: r.corpo_numero_processo != null ? String(r.corpo_numero_processo) : null,
    corpoTotalSessoes: r.corpo_total_sessoes != null ? Number(r.corpo_total_sessoes) : null,
    templateCodigo: r.template_codigo != null ? String(r.template_codigo) : null,
  };
}

export async function criarNfDeCobranca(cobrancaId: string): Promise<string> {
  const { data, error } = await supabase.rpc("criar_nf_de_cobranca", { p_cobranca_id: cobrancaId });
  if (error) throw error;
  return String(data);
}

export async function fetchCobrancasSemNf(mes: number, ano: number): Promise<CobrancaSemNf[]> {
  const { data, error } = await supabase.rpc("cobrancas_sem_nf", { p_mes: mes, p_ano: ano });
  if (error) throw error;
  return ((data ?? []) as {
    cobranca_id: string;
    paciente_id: string;
    paciente_nome: string;
    tipo: PacienteTipo;
    valor: number | string;
    competencia_mes: number | null;
    competencia_ano: number | null;
    destinatario_nome: string | null;
    destinatario_documento: string | null;
    status: CobrancaStatus;
  }[]).map((r) => ({
    cobrancaId: r.cobranca_id,
    pacienteId: r.paciente_id,
    pacienteNome: r.paciente_nome,
    tipo: r.tipo,
    valor: Number(r.valor) || 0,
    competenciaMes: r.competencia_mes,
    competenciaAno: r.competencia_ano,
    destinatarioNome: r.destinatario_nome,
    destinatarioDocumento: r.destinatario_documento,
    status: r.status,
  }));
}

export async function atualizarCobrancasVencidas(): Promise<number> {
  const { data, error } = await supabase.rpc("atualizar_cobrancas_vencidas");
  if (error) throw error;
  return Number(data) || 0;
}
