/** Espelho TS da regra R5 corrigida (scripts/lib/retroativos_valor.py). */
export function calcValorRetroativo(
  valorMensal: number | null | undefined,
  previstoPlanilha: number,
): number {
  if (valorMensal != null && valorMensal > 0) {
    return Math.round(valorMensal * 100) / 100;
  }
  return Math.round(previstoPlanilha * 100) / 100;
}

export function calcValorMesAtual(previstoPlanilha: number): number {
  return Math.round(previstoPlanilha * 100) / 100;
}

export function parseValorBr(v: unknown): number | null {
  if (typeof v === "number" && v > 0) return v;
  const s = String(v ?? "")
    .replace(/R\$/g, "")
    .replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const f = parseFloat(normalized);
  return Number.isNaN(f) || f <= 0 ? null : f;
}
