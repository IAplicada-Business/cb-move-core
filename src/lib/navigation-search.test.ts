import { describe, expect, it } from "vitest";

import {
  resolveAgendaVisao,
  resolveNotasFiscaisTab,
  resolvePacienteTab,
  resolveRelatoriosTab,
} from "./navigation-search";

describe("navigation-search", () => {
  it("resolvePacienteTab defaults to dados", () => {
    expect(resolvePacienteTab(undefined)).toBe("dados");
    expect(resolvePacienteTab("comparecimento")).toBe("comparecimento");
  });

  it("resolveAgendaVisao defaults to semana", () => {
    expect(resolveAgendaVisao(undefined)).toBe("semana");
    expect(resolveAgendaVisao("mes")).toBe("mes");
    expect(resolveAgendaVisao("atualizacoes")).toBe("atualizacoes");
  });

  it("resolveRelatoriosTab defaults to gerar", () => {
    expect(resolveRelatoriosTab(undefined)).toBe("gerar");
    expect(resolveRelatoriosTab("historico")).toBe("historico");
  });

  it("resolveNotasFiscaisTab defaults to emissao", () => {
    expect(resolveNotasFiscaisTab(undefined)).toBe("emissao");
    expect(resolveNotasFiscaisTab("ir")).toBe("ir");
  });
});
