import type { MatchCobranca } from "@/lib/extrato-parser";

const STORAGE_KEY = "cbmove:conciliacao-matches-recentes";
const MAX_ITEMS = 12;

export type MatchConciliacaoRecente = MatchCobranca & {
  registradoEm: string;
  arquivoNome?: string;
};

function safeParse(raw: string | null): MatchConciliacaoRecente[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MatchConciliacaoRecente[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadMatchesRecentes(): MatchConciliacaoRecente[] {
  if (typeof sessionStorage === "undefined") return [];
  return safeParse(sessionStorage.getItem(STORAGE_KEY));
}

export function saveMatchesRecentes(
  matches: MatchCobranca[],
  arquivoNome?: string,
): MatchConciliacaoRecente[] {
  const registradoEm = new Date().toISOString();
  const enriched: MatchConciliacaoRecente[] = matches.map((m) => ({
    ...m,
    registradoEm,
    arquivoNome,
  }));

  const prev = loadMatchesRecentes().filter(
    (p) => !enriched.some((e) => e.cobrancaId === p.cobrancaId),
  );
  const next = [...enriched, ...prev].slice(0, MAX_ITEMS);

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearMatchesRecentes() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function removeMatchesRecentesByCobrancaIds(ids: string[]): MatchConciliacaoRecente[] {
  const idSet = new Set(ids);
  const next = loadMatchesRecentes().filter((m) => !idSet.has(m.cobrancaId));
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
