import { describe, expect, it } from "vitest";

import {
  evolucaoStatus,
  resolveSessaoId,
  sessaoOptionLabel,
  buildHistoricoDocumentosAssinados,
} from "./utils";
import type {
  SessaoProntuario,
  EvolucaoComRelacoes,
  RelatorioAtendimento,
} from "../../../lib/queries/prontuario";

function sessao(
  id: string,
  sigla: SessaoProntuario["sigla"],
  hora: string | null = "09:00:00",
): SessaoProntuario {
  return { id, data: "2026-06-19", hora, sigla, observacoes: null };
}

describe("evolucaoStatus", () => {
  it("retorna assinada quando assinado_em preenchido", () => {
    expect(
      evolucaoStatus({
        subjetivo: "Relato",
        objetivo: "Medidas",
        plano: "Conduta",
        transcricao_raw: null,
        assinado_em: "2026-08-06T12:00:00Z",
      }),
    ).toBe("assinada");
  });

  it("retorna registrada quando S/O/P completos", () => {
    expect(
      evolucaoStatus({
        subjetivo: "Relato",
        objetivo: "Medidas",
        plano: "Conduta",
        transcricao_raw: null,
      }),
    ).toBe("registrada");
  });

  it("retorna rascunho com transcrição sem SOAP", () => {
    expect(
      evolucaoStatus({
        subjetivo: null,
        objetivo: null,
        plano: null,
        transcricao_raw: "Paciente relatou dor",
      }),
    ).toBe("rascunho");
  });

  it("retorna rascunho com SOAP parcial", () => {
    expect(
      evolucaoStatus({
        subjetivo: "Relato",
        objetivo: null,
        plano: null,
        transcricao_raw: null,
      }),
    ).toBe("rascunho");
  });
});

describe("resolveSessaoId", () => {
  it("retorna null sem sessões", () => {
    expect(resolveSessaoId([])).toBeNull();
  });

  it("retorna única sessão automaticamente", () => {
    expect(resolveSessaoId([sessao("a", "P")])).toBe("a");
  });

  it("prefere P ou RC entre várias", () => {
    const sessoes = [
      sessao("fj", "FJ", "08:00:00"),
      sessao("p", "P", "09:00:00"),
      sessao("nr", "NR", "10:00:00"),
    ];
    expect(resolveSessaoId(sessoes)).toBe("p");
  });

  it("usa RC se não houver P", () => {
    const sessoes = [sessao("nr", "NR"), sessao("rc", "RC")];
    expect(resolveSessaoId(sessoes)).toBe("rc");
  });

  it("usa primeira sessão se nenhuma P/RC", () => {
    const sessoes = [sessao("fj", "FJ"), sessao("nr", "NR")];
    expect(resolveSessaoId(sessoes)).toBe("fj");
  });
});

describe("sessaoOptionLabel", () => {
  it("formata hora e sigla", () => {
    expect(sessaoOptionLabel(sessao("x", "P", "09:30:00"))).toBe("09:30 · P");
  });
});

describe("buildHistoricoDocumentosAssinados", () => {
  const evolucoes: EvolucaoComRelacoes[] = [
    {
      id: "ev1",
      paciente_id: "p1",
      fisioterapeuta_id: "f1",
      sessao_id: null,
      data: "2026-08-05",
      subjetivo: "S",
      objetivo: "O",
      plano: "P",
      transcricao_raw: null,
      fonte: "manual",
      created_at: "2026-08-05T10:00:00Z",
      assinado_em: "2026-08-05T11:00:00Z",
      fisioterapeutas: { nome: "Dr. Teste" },
    },
    {
      id: "ev2",
      paciente_id: "p1",
      fisioterapeuta_id: "f1",
      sessao_id: null,
      data: "2026-08-06",
      subjetivo: "S",
      objetivo: "O",
      plano: "P",
      transcricao_raw: null,
      fonte: "manual",
      created_at: "2026-08-06T10:00:00Z",
    },
  ];

  const relatorios: RelatorioAtendimento[] = [
    {
      id: "rel1",
      paciente_id: "p1",
      modelo: "padrao",
      competencia_mes: 8,
      competencia_ano: 2026,
      pdf_url: "https://example.com/r.pdf",
      xlsx_url: null,
      formato_arquivo: null,
      assinado: true,
      assinado_em: "2026-08-07T09:00:00Z",
      modelo_pdf: null,
      created_at: "2026-08-07T08:00:00Z",
    },
    {
      id: "rel2",
      paciente_id: "p1",
      modelo: "padrao",
      competencia_mes: 7,
      competencia_ano: 2026,
      pdf_url: null,
      xlsx_url: null,
      formato_arquivo: null,
      assinado: true,
      assinado_em: "2026-07-01T09:00:00Z",
      modelo_pdf: null,
      created_at: "2026-07-01T08:00:00Z",
    },
  ];

  it("filtra por competência e inclui só assinados", () => {
    const rows = buildHistoricoDocumentosAssinados(evolucoes, relatorios, 8, 2026);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.kind)).toEqual(["relatorio_mensal", "evolucao_diaria"]);
  });

  it("ordena por data de assinatura decrescente", () => {
    const rows = buildHistoricoDocumentosAssinados(evolucoes, relatorios, 8, 2026);
    expect(rows[0]?.id).toBe("rel-rel1");
    expect(rows[1]?.id).toBe("ev-ev1");
  });
});
