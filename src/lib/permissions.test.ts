import { describe, expect, it } from "vitest";

import { can, isFisioScopedUser } from "./permissions";

describe("isFisioScopedUser", () => {
  it("identifica membro com cadastro clínico", () => {
    expect(isFisioScopedUser(["membro"], "fisio-1")).toBe(true);
  });

  it("exclui admin e legado operacional", () => {
    expect(isFisioScopedUser(["admin"], null)).toBe(false);
    expect(isFisioScopedUser(["gestao"], null)).toBe(false);
    expect(isFisioScopedUser(["recepcao"], null)).toBe(false);
  });

  it("membro sem fisio_id não é fisio clínico scoped", () => {
    expect(isFisioScopedUser(["membro"], null)).toBe(false);
  });
});

describe("can.viewFinance", () => {
  it("permite admin e legado gestao/recepcao", () => {
    expect(can.viewFinance(["admin"], null)).toBe(true);
    expect(can.viewFinance(["gestao"], null)).toBe(true);
    expect(can.viewFinance(["recepcao"], null)).toBe(true);
  });

  it("bloqueia fisio clínico (membro + fisio_id)", () => {
    expect(can.viewFinance(["membro"], "fisio-1")).toBe(false);
    expect(can.viewFinance(["fisio"], null)).toBe(false);
  });

  it("bloqueia membro sem vínculo clínico", () => {
    expect(can.viewFinance(["membro"], null)).toBe(false);
  });
});

describe("can.accessApp", () => {
  it("permite equipe staff", () => {
    expect(can.accessApp(["admin"])).toBe(true);
    expect(can.accessApp(["membro"])).toBe(true);
  });

  it("nega cliente e conta sem papel", () => {
    expect(can.accessApp(["cliente"])).toBe(false);
    expect(can.accessApp([])).toBe(false);
  });
});
