/** Normaliza texto para busca insensível a acentos e caixa. */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

/** Extrai apenas dígitos (útil para CPF). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Busca por nome (acentos) ou CPF (com ou sem máscara). */
export function matchesPatientSearch(
  nome: string,
  cpf: string | null | undefined,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;

  const normalizedQuery = normalizeSearchText(q);
  if (normalizeSearchText(nome).includes(normalizedQuery)) return true;

  const queryDigits = digitsOnly(q);
  if (queryDigits.length >= 3 && cpf && digitsOnly(cpf).includes(queryDigits)) {
    return true;
  }

  return false;
}
