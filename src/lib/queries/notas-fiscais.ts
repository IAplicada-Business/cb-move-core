import { supabase } from "@/integrations/supabase/client";
import type { NfStatus, PacienteTipo } from "../types";

export type NotaFiscal = {
  id: string;
  numero: string | null;
  pacienteId: string;
  pacienteNome: string | null;
  cobrancaId: string | null;
  tipo: PacienteTipo;
  destinatarioNome: string | null;
  destinatarioDocumento: string | null;
  corpoPacienteNome: string | null;
  corpoPacienteCpf: string | null;
  corpoDiasAtendidos: number | null;
  corpoTotalSessoes: number | null;
  corpoValorTotal: number | null;
  corpoNumeroProcesso: string | null;
  valor: number;
  emissao: string | null;
  status: NfStatus;
  pdfUrl: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  numero: string | null;
  paciente_id: string;
  cobranca_id: string | null;
  tipo: PacienteTipo;
  destinatario_nome: string | null;
  destinatario_documento: string | null;
  corpo_paciente_nome: string | null;
  corpo_paciente_cpf: string | null;
  corpo_dias_atendidos: number | null;
  corpo_total_sessoes: number | null;
  corpo_valor_total: number | null;
  corpo_numero_processo: string | null;
  valor: number | string;
  emissao: string | null;
  status: NfStatus;
  pdf_url: string | null;
  created_at: string;
  pacientes?: { nome: string } | null;
};

const map = (r: Row): NotaFiscal => ({
  id: r.id,
  numero: r.numero,
  pacienteId: r.paciente_id,
  pacienteNome: r.pacientes?.nome ?? null,
  cobrancaId: r.cobranca_id,
  tipo: r.tipo,
  destinatarioNome: r.destinatario_nome,
  destinatarioDocumento: r.destinatario_documento,
  corpoPacienteNome: r.corpo_paciente_nome,
  corpoPacienteCpf: r.corpo_paciente_cpf,
  corpoDiasAtendidos: r.corpo_dias_atendidos,
  corpoTotalSessoes: r.corpo_total_sessoes,
  corpoValorTotal: r.corpo_valor_total,
  corpoNumeroProcesso: r.corpo_numero_processo,
  valor: Number(r.valor) || 0,
  emissao: r.emissao,
  status: r.status,
  pdfUrl: r.pdf_url,
  createdAt: r.created_at,
});

export async function fetchNFs(filters?: {
  status?: NfStatus;
  tipo?: PacienteTipo;
  competenciaMes?: number;
  competenciaAno?: number;
  search?: string;
}): Promise<NotaFiscal[]> {
  let query = supabase
    .from("notas_fiscais")
    .select("*, pacientes(nome)")
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.tipo) query = query.eq("tipo", filters.tipo);
  if (filters?.competenciaMes && filters?.competenciaAno) {
    const mes = String(filters.competenciaMes).padStart(2, "0");
    const ano = filters.competenciaAno;
    query = query
      .gte("emissao", `${ano}-${mes}-01`)
      .lt("emissao", mes === "12"
        ? `${ano + 1}-01-01`
        : `${ano}-${String(filters.competenciaMes + 1).padStart(2, "0")}-01`
      );
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Row[]).map(map);

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return rows.filter(
      nf =>
        nf.pacienteNome?.toLowerCase().includes(q) ||
        nf.destinatarioNome?.toLowerCase().includes(q) ||
        nf.numero?.toLowerCase().includes(q)
    );
  }
  return rows;
}

export async function createNF(input: {
  pacienteId: string;
  tipo: PacienteTipo;
  cobrancaId?: string;
  destinatarioNome: string;
  destinatarioDocumento?: string;
  valor: number;
  emissao?: string;
  competenciaMes?: number;
  competenciaAno?: number;
  corpoPacienteNome?: string;
  corpoPacienteCpf?: string;
  corpoNumeroProcesso?: string;
  corpoTotalSessoes?: number;
}): Promise<NotaFiscal> {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .insert({
      paciente_id: input.pacienteId,
      tipo: input.tipo,
      cobranca_id: input.cobrancaId ?? null,
      destinatario_nome: input.destinatarioNome,
      destinatario_documento: input.destinatarioDocumento ?? null,
      valor: input.valor,
      emissao: input.emissao ?? new Date().toISOString().split("T")[0],
      status: "pendente",
      corpo_paciente_nome: input.corpoPacienteNome ?? null,
      corpo_paciente_cpf: input.corpoPacienteCpf ?? null,
      corpo_numero_processo: input.corpoNumeroProcesso ?? null,
      corpo_total_sessoes: input.corpoTotalSessoes ?? null,
    })
    .select("*, pacientes(nome)")
    .single();
  if (error) throw error;
  return map(data as unknown as Row);
}

export async function countNotasMonth(year: number, month: number): Promise<number> {
  const mes = String(month).padStart(2, "0");
  const nextMes = month === 12 ? "01" : String(month + 1).padStart(2, "0");
  const nextAno = month === 12 ? year + 1 : year;

  const { count, error } = await supabase
    .from("notas_fiscais")
    .select("*", { count: "exact", head: true })
    .eq("status", "emitida")
    .gte("emissao", `${year}-${mes}-01`)
    .lt("emissao", `${nextAno}-${nextMes}-01`);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchNFsPorPacienteAno(
  pacienteId: string,
  ano: number
): Promise<NotaFiscal[]> {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select("*, pacientes(nome)")
    .eq("paciente_id", pacienteId)
    .eq("status", "emitida")
    .gte("emissao", `${ano}-01-01`)
    .lte("emissao", `${ano}-12-31`)
    .order("emissao");
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(map);
}

export async function fetchReceitaPorConvenio(ano: number): Promise<{
  convenio: string;
  meses: Record<number, number>;
  total: number;
}[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("valor, tipo, competencia_mes, competencia_ano, pacientes(convenio_id, convenios(nome))")
    .eq("competencia_ano", ano)
    .in("status", ["pago", "pendente", "aguardando_convenio", "aguardando_alvara"]);

  if (error) throw error;

  // Agrupa por tipo/convênio
  const buckets: Map<string, { convenio: string; meses: Record<number, number>; total: number }> = new Map();

  for (const c of data ?? []) {
    const nome = (c as unknown as { pacientes?: { convenios?: { nome?: string } } }).pacientes?.convenios?.nome
      || c.tipo;
    if (!buckets.has(nome)) {
      buckets.set(nome, { convenio: nome, meses: {}, total: 0 });
    }
    const b = buckets.get(nome)!;
    const mes = c.competencia_mes ?? 0;
    b.meses[mes] = (b.meses[mes] ?? 0) + Number(c.valor);
    b.total += Number(c.valor);
  }

  return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
}
