import { supabase } from "@/integrations/supabase/client";

export type NotaIrRow = {
  id: string;
  numero: string | null;
  emissao: string | null;
  destinatario_nome: string | null;
  status: string | null;
  valor: number | null;
};

export type RelatorioIrPdfResult = {
  paciente_nome: string;
  paciente_cpf: string | null;
  ano: number;
  total: number;
  qtd_notas: number;
  filename: string;
  pdf_base64: string;
  content_type: string;
};

export async function fetchNotasIrPacienteAno(
  pacienteId: string,
  ano: number,
): Promise<NotaIrRow[]> {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select("id, numero, emissao, destinatario_nome, status, valor")
    .eq("paciente_id", pacienteId)
    .eq("status", "emitida")
    .gte("emissao", `${ano}-01-01`)
    .lte("emissao", `${ano}-12-31`)
    .order("emissao");

  if (error) throw error;
  return (data as NotaIrRow[] | null) ?? [];
}

export async function gerarRelatorioIrPdf(
  pacienteId: string,
  ano: number,
): Promise<RelatorioIrPdfResult> {
  const { data, error } = await supabase.functions.invoke("gerar-relatorio-ir", {
    body: { paciente_id: pacienteId, ano },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.pdf_base64 || !data?.filename) {
    throw new Error("Resposta inválida do gerador de IR");
  }
  return data as RelatorioIrPdfResult;
}

export function downloadPdfBase64(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
