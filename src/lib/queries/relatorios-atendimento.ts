import { supabase } from "@/integrations/supabase/client";
import type { ModeloRelatorio, PacienteTipo } from "@/lib/types";

export type RelatorioAtendimentoHistoricoRow = {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  paciente_tipo: PacienteTipo;
  paciente_convenio_id: string | null;
  convenio_nome: string | null;
  modelo: ModeloRelatorio;
  competencia_mes: number;
  competencia_ano: number;
  num_sessoes: number | null;
  pdf_url: string | null;
  xlsx_url: string | null;
  formato_arquivo: string | null;
  assinado: boolean;
  status: string | null;
  modelo_pdf: string | null;
  created_at: string;
};

export type RelatorioHistoricoFilters = {
  mes?: number;
  ano?: number;
  tipo?: PacienteTipo | "all";
  convenioId?: string;
  search?: string;
};

type RelatorioRowDb = {
  id: string;
  paciente_id: string;
  modelo: ModeloRelatorio;
  competencia_mes: number;
  competencia_ano: number;
  num_sessoes: number | null;
  pdf_url: string | null;
  xlsx_url: string | null;
  formato_arquivo: string | null;
  assinado: boolean;
  status: string | null;
  modelo_pdf: string | null;
  created_at: string;
  pacientes: {
    nome: string;
    tipo: PacienteTipo;
    convenio_id: string | null;
    convenios: { nome: string } | null;
  };
};

export async function fetchRelatoriosAtendimentoHistorico(
  filters: RelatorioHistoricoFilters,
): Promise<RelatorioAtendimentoHistoricoRow[]> {
  const { mes, ano, tipo = "all", convenioId, search } = filters;

  let query = supabase
    .from("relatorios_atendimento")
    .select(
      `id, paciente_id, modelo, competencia_mes, competencia_ano, num_sessoes, pdf_url, xlsx_url, formato_arquivo, assinado, status, modelo_pdf, created_at,
      pacientes!inner(nome, tipo, convenio_id, convenios(nome))`,
    )
    .order("created_at", { ascending: false });

  if (mes !== undefined && ano !== undefined) {
    query = query.eq("competencia_mes", mes).eq("competencia_ano", ano);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as RelatorioRowDb[];
  const q = search?.trim().toLowerCase();

  return rows
    .map((r) => ({
      id: r.id,
      paciente_id: r.paciente_id,
      paciente_nome: r.pacientes.nome,
      paciente_tipo: r.pacientes.tipo,
      paciente_convenio_id: r.pacientes.convenio_id,
      convenio_nome: r.pacientes.convenios?.nome ?? null,
      modelo: r.modelo,
      competencia_mes: r.competencia_mes,
      competencia_ano: r.competencia_ano,
      num_sessoes: r.num_sessoes,
      pdf_url: r.pdf_url,
      xlsx_url: r.xlsx_url,
      formato_arquivo: r.formato_arquivo ?? "pdf",
      assinado: r.assinado,
      status: r.status,
      modelo_pdf: r.modelo_pdf,
      created_at: r.created_at,
    }))
    .filter((r) => {
      if (tipo !== "all" && r.paciente_tipo !== tipo) return false;
      if (convenioId && r.paciente_convenio_id !== convenioId) return false;
      if (q && !r.paciente_nome.toLowerCase().includes(q)) return false;
      return true;
    });
}
