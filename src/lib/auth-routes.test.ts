import { describe, expect, it } from "vitest";

import { resolvePostAuthPathFromRoles } from "./auth-routes";

describe("resolvePostAuthPathFromRoles", () => {
  it("envia cliente para /portal", () => {
    expect(resolvePostAuthPathFromRoles(["cliente"], false)).toBe("/portal");
  });

  it("envia admin e membro para /app", () => {
    expect(resolvePostAuthPathFromRoles(["admin"], false)).toBe("/app");
    expect(resolvePostAuthPathFromRoles(["membro"], false)).toBe("/app");
  });

  it("envia legado gestao/recepcao para /app", () => {
    expect(resolvePostAuthPathFromRoles(["gestao"], false)).toBe("/app");
    expect(resolvePostAuthPathFromRoles(["recepcao"], false)).toBe("/app");
  });

  it("envia paciente vinculado sem papel para /portal", () => {
    expect(resolvePostAuthPathFromRoles([], true)).toBe("/portal");
  });

  it("envia conta sem papel para /sem-acesso", () => {
    expect(resolvePostAuthPathFromRoles([], false)).toBe("/sem-acesso");
  });

  it("prioriza cliente sobre staff quando ambos existem", () => {
    expect(resolvePostAuthPathFromRoles(["cliente", "membro"], false)).toBe("/portal");
  });
});
