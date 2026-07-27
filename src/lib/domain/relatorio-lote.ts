import type { PacienteTipo } from "@/lib/types";

export type PacienteRelatorioLote = {
  id: string;
  nome: string;
  convenioId?: string | null;
};

/** Pacientes elegíveis para lote no escopo selecionado (convênio exige ID). */
export function filterPacientesRelatorioLote(
  pacientes: PacienteRelatorioLote[],
  tipo: PacienteTipo,
  convenioId: string,
): PacienteRelatorioLote[] {
  if (tipo === "convenio" && !convenioId) return [];
  return pacientes.filter((p) => tipo !== "convenio" || p.convenioId === convenioId);
}

export function podeGerarLoteRelatorio(
  pacientesFiltrados: readonly unknown[],
  tipo: PacienteTipo,
  convenioId: string,
): boolean {
  return pacientesFiltrados.length > 0 && (tipo !== "convenio" || Boolean(convenioId));
}

export function mensagemEscopoRelatorioLote(input: {
  isLoading: boolean;
  tipo: PacienteTipo;
  convenioId: string;
  count: number;
  tipoLabel: string;
}): string {
  if (input.isLoading) return "Carregando pacientes…";
  if (input.tipo === "convenio" && !input.convenioId) {
    return "Selecione um convênio para ver os pacientes e gerar em lote.";
  }
  if (input.count === 0) return "Nenhum paciente ativo encontrado neste escopo.";
  return `${input.count} paciente(s) ativo(s) · modelo ${input.tipoLabel.toLowerCase()}`;
}
