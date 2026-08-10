import type { FilterChipOption } from "@/components/domain/FilterChip";

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function competenciaAtual(): string {
  const now = new Date();
  return `${now.getMonth() + 1}-${now.getFullYear()}`;
}

export function competenciaOpcoes(months = 12): FilterChipOption[] {
  const now = new Date();
  const opts: FilterChipOption[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mes = d.getMonth() + 1;
    const ano = d.getFullYear();
    opts.push({
      value: `${mes}-${ano}`,
      label: `${MESES_ABREV[d.getMonth()]}/${ano}`,
    });
  }
  return opts;
}

export function parseCompetencia(value: string): { mes: number; ano: number } | null {
  if (!value || value.includes("todas") || value === "todos") return null;
  const [m, a] = value.split("-");
  const mes = Number(m);
  const ano = Number(a);
  if (!mes || !ano) return null;
  return { mes, ano };
}

export function mesAbrev(mes: number): string {
  return MESES_ABREV[mes - 1] ?? String(mes);
}

export function competenciaLabel(mes: number, ano: number): string {
  return `${mesAbrev(mes)}/${ano}`;
}

export function competenciaLabelCurto(mes: number, ano: number): string {
  return `${mesAbrev(mes)}/${String(ano).slice(-2)}`;
}

export function competenciaLabelFromDate(date: Date, anoCurto = false): string {
  const mes = date.getMonth() + 1;
  const ano = date.getFullYear();
  return anoCurto ? competenciaLabelCurto(mes, ano) : competenciaLabel(mes, ano);
}
