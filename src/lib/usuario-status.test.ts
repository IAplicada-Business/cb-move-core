import { describe, expect, it } from "vitest";

import type { UserRow } from "@/lib/queries/usuarios";

import { usuarioAguardandoPrimeiroAcesso, usuarioStatusLabel } from "./usuario-status";

const baseUser: UserRow = {
  id: "u1",
  nome: "Charlene",
  email: "cbmoveneuro@gmail.com",
  created_at: "",
  role: "admin",
  paciente_id: null,
  paciente_nome: null,
  fisioterapeuta_id: null,
};

describe("usuarioStatusLabel", () => {
  it("prioriza last_sign_in_at sobre flag stale de referência", () => {
    expect(
      usuarioStatusLabel({
        ...baseUser,
        must_reset_password: true,
        last_sign_in_at: "2026-08-01T12:00:00Z",
        auth_meta_loaded: true,
      }),
    ).toBe("Ativo");
  });

  it("mostra aguardando apenas sem login e com flag explícita", () => {
    expect(
      usuarioStatusLabel({
        ...baseUser,
        must_reset_password: true,
        last_sign_in_at: null,
        auth_meta_loaded: true,
      }),
    ).toBe("Aguardando 1º acesso");
  });

  it("sem metadados de auth usa Cadastrado em vez de Ativo", () => {
    expect(usuarioStatusLabel({ ...baseUser, auth_meta_loaded: false })).toBe("Cadastrado");
  });

  it("não cadastrado", () => {
    expect(usuarioStatusLabel(undefined)).toBe("Não cadastrado");
  });
});

describe("usuarioAguardandoPrimeiroAcesso", () => {
  it("false quando já houve login", () => {
    expect(
      usuarioAguardandoPrimeiroAcesso({
        ...baseUser,
        must_reset_password: true,
        last_sign_in_at: "2026-08-01T12:00:00Z",
        auth_meta_loaded: true,
      }),
    ).toBe(false);
  });
});
