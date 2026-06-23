// Stub de domínio de frequência. Implementação real virá com a entidade `frequencia`.
export type RegistroFrequencia = {
  id: string;
  pacienteId: string;
  data: string;
  presente: boolean;
};

export function taxaPresenca(registros: RegistroFrequencia[]): number {
  if (registros.length === 0) return 0;
  const presentes = registros.filter((r) => r.presente).length;
  return presentes / registros.length;
}
