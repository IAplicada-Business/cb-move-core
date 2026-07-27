import { describe, expect, it } from "vitest";

import { evolucaoStatus, resolveSessaoId, sessaoOptionLabel } from "./utils";
import type { SessaoProntuario } from "../../../lib/queries/prontuario";

function sessao(
  id: string,
  sigla: SessaoProntuario["sigla"],
  hora: string | null = "09:00:00",
): SessaoProntuario {
  return { id, data: "2026-06-19", hora, sigla, observacoes: null };
}

describe("evolucaoStatus", () => {
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
