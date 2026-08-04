export type FisioUsoLogCategoria =
  "sessao" | "evolucao" | "relatorio" | "avaliacao" | "agenda" | "periodizacao";

export type FisioUsoLog = {
  id: string;
  ts: string;
  categoria: FisioUsoLogCategoria;
  titulo: string;
  detalhe?: string;
};

/** Linha retornada pela RPC `get_fisio_uso_logs`. */
export type FisioUsoLogRow = {
  id: string;
  ts: string;
  categoria: string;
  titulo: string;
  detalhe: string | null;
};

export const FISIO_USO_LOGS_MAX_LIMIT = 100;

const CATEGORIAS: FisioUsoLogCategoria[] = [
  "sessao",
  "evolucao",
  "relatorio",
  "avaliacao",
  "agenda",
  "periodizacao",
];

function isCategoria(v: string): v is FisioUsoLogCategoria {
  return (CATEGORIAS as string[]).includes(v);
}

export function clampFisioUsoLogsLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), FISIO_USO_LOGS_MAX_LIMIT);
}

export function mapFisioUsoLogRows(rows: FisioUsoLogRow[]): FisioUsoLog[] {
  return rows
    .filter((row): row is FisioUsoLogRow & { categoria: FisioUsoLogCategoria } =>
      isCategoria(row.categoria),
    )
    .map((row) => ({
      id: row.id,
      ts: row.ts,
      categoria: row.categoria,
      titulo: row.titulo,
      detalhe: row.detalhe ?? undefined,
    }));
}
