/** Identificador fixo da evolução espelhando a Primeira Consulta Experimental. */
export const CONSULTA_EXPERIMENTAL_SUBJETIVO = "Primeira Consulta Experimental";

export type ConsultaExperimentalEvolucaoContent = {
  data: string;
  subjetivo: string;
  objetivo: string;
  plano: string;
};

export function buildConsultaExperimentalEvolucao(input: {
  data: string;
  observacoes: string | null;
  fisioNome: string | null;
}): ConsultaExperimentalEvolucaoContent {
  const partes: string[] = [];
  if (input.fisioNome?.trim()) {
    partes.push(`Fisioterapeuta avaliador: ${input.fisioNome.trim()}`);
  }
  if (input.observacoes?.trim()) {
    partes.push(input.observacoes.trim());
  }

  return {
    data: input.data,
    subjetivo: CONSULTA_EXPERIMENTAL_SUBJETIVO,
    objetivo: partes.length > 0 ? partes.join("\n\n") : "Avaliação inicial realizada.",
    plano: "Encaminhar para definição de frequência e periodização do tratamento.",
  };
}

export function shouldSyncConsultaExperimentalProntuario(input: {
  consultaExperimentalEm: string | null;
  consultaExperimentalFisioId: string | null;
  consultaExperimentalObservacoes: string | null;
}): boolean {
  return !!input.consultaExperimentalEm?.trim();
}
