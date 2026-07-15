import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import type { NfStatus, PacienteTipo } from "../types";

export type EmitNfAutomaticoResult = {
  ok: boolean;
  nf_id: string;
  status: NfStatus | string;
  focus_status?: string;
  focus_ref?: string;
  message?: string;
  error?: string;
  numero?: string;
  pdf_url?: string | null;
  email?: { ok: boolean; queued?: boolean; error?: string };
};

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
  corpoDiasAtendidos: string | null;
  corpoTotalSessoes: number | null;
  corpoValorTotal: number | null;
  corpoNumeroProcesso: string | null;
  valor: number;
  emissao: string | null;
  competenciaMes: number | null;
  competenciaAno: number | null;
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
  corpo_dias_atendidos: string | null;
  corpo_total_sessoes: number | null;
  corpo_valor_total: number | null;
  corpo_numero_processo: string | null;
  valor: number | string;
  emissao: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
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
  competenciaMes: r.competencia_mes,
  competenciaAno: r.competencia_ano,
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
    query = query
      .eq("competencia_mes", filters.competenciaMes)
      .eq("competencia_ano", filters.competenciaAno);
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
      competencia_mes: input.competenciaMes ?? null,
      competencia_ano: input.competenciaAno ?? null,
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

export async function updateNF(
  id: string,
  patch: Partial<{
    numero: string;
    status: NfStatus;
    pdfUrl: string;
    emissao: string;
    destinatarioNome: string;
    destinatarioDocumento: string;
  }>,
): Promise<NotaFiscal> {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .update({
      ...(patch.numero != null ? { numero: patch.numero } : {}),
      ...(patch.status != null ? { status: patch.status } : {}),
      ...(patch.pdfUrl != null ? { pdf_url: patch.pdfUrl } : {}),
      ...(patch.emissao != null ? { emissao: patch.emissao } : {}),
      ...(patch.destinatarioNome != null ? { destinatario_nome: patch.destinatarioNome } : {}),
      ...(patch.destinatarioDocumento != null ? { destinatario_documento: patch.destinatarioDocumento } : {}),
    })
    .eq("id", id)
    .select("*, pacientes(nome)")
    .single();
  if (error) throw error;
  return map(data as unknown as Row);
}

export async function uploadNfPdf(file: File, ano: number, numero: string): Promise<string> {
  const path = `nf/${ano}/${numero}.pdf`;
  const { error } = await supabase.storage.from("notas-fiscais").upload(path, file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("notas-fiscais").getPublicUrl(path);
  return data.publicUrl;
}

export async function sendNfEmail(nfId: string, tipo: PacienteTipo): Promise<{ ok: boolean; queued: boolean }> {
  return invokeEdgeFunction<{ ok: boolean; queued: boolean }>("send-nf-email", {
    nf_id: nfId,
    tipo,
    event_id: `nf-email-${nfId}`,
  });
}

export async function emitNfManual(nfId: string, numero: string, pdfUrl: string): Promise<void> {
  await invokeEdgeFunction("emit-nf", {
    nf_id: nfId,
    modo: "manual",
    numero,
    pdf_url: pdfUrl,
  });
}

export async function emitNfAutomatico(nfId: string): Promise<EmitNfAutomaticoResult> {
  return invokeEdgeFunction<EmitNfAutomaticoResult>("emit-nf", {
    nf_id: nfId,
    modo: "automatico",
  });
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
