import { describe, expect, it } from "vitest";

import {
  clampFisioUsoLogsLimit,
  FISIO_USO_LOGS_MAX_LIMIT,
  mapFisioUsoLogRows,
  type FisioUsoLogRow,
} from "./fisio-uso-logs";

/** Amostras no formato retornado pela RPC `get_fisio_uso_logs`. */
const RPC_SAMPLES: FisioUsoLogRow[] = [
  {
    id: "sessao-abc",
    ts: "2026-08-01T12:00:00Z",
    categoria: "sessao",
    titulo: "Sessão registrada",
    detalhe: "João Silva · P · 01/08/2026",
  },
  {
    id: "relatorio-assinado-def",
    ts: "2026-08-01T11:00:00Z",
    categoria: "relatorio",
    titulo: "Relatório assinado",
    detalhe: "João Silva · 07/2026",
  },
  {
    id: "evolucao-assinada-xyz",
    ts: "2026-08-06T16:00:00Z",
    categoria: "evolucao",
    titulo: "Evolução assinada",
    detalhe: "João Silva · 06/08/2026",
  },
  {
    id: "agenda-ghi",
    ts: "2026-08-01T10:00:00Z",
    categoria: "agenda",
    titulo: "Remanejamento na agenda (mensal)",
    detalhe: null,
  },
  {
    id: "periodizacao-jkl",
    ts: "2026-08-01T09:00:00Z",
    categoria: "periodizacao",
    titulo: "Sessão de periodização cadastrada",
    detalhe: "João Silva · sessão 3",
  },
];

describe("clampFisioUsoLogsLimit", () => {
  it("limita entre 1 e o máximo da RPC", () => {
    expect(clampFisioUsoLogsLimit(0)).toBe(1);
    expect(clampFisioUsoLogsLimit(25)).toBe(25);
    expect(clampFisioUsoLogsLimit(500)).toBe(FISIO_USO_LOGS_MAX_LIMIT);
  });
});

describe("mapFisioUsoLogRows", () => {
  it("mapeia linhas da RPC e descarta categorias desconhecidas", () => {
    const rows = mapFisioUsoLogRows([
      ...RPC_SAMPLES,
      {
        id: "x-1",
        ts: "2026-08-01T08:00:00Z",
        categoria: "desconhecida",
        titulo: "Ignorar",
        detalhe: null,
      },
    ]);

    expect(rows).toHaveLength(RPC_SAMPLES.length);
    expect(rows[0]).toMatchObject({
      id: "sessao-abc",
      categoria: "sessao",
      detalhe: "João Silva · P · 01/08/2026",
    });
    expect(rows[1].titulo).toBe("Relatório assinado");
    expect(rows[2].titulo).toBe("Evolução assinada");
    expect(rows[3].detalhe).toBeUndefined();
  });
});
