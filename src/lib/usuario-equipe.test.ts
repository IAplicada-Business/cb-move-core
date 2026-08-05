import { describe, expect, it } from "vitest";

import type { UserRow } from "@/lib/queries/usuarios";

import {
  cadastroPerfilFromUsuarioRow,
  equipeInputFromUsuarioRow,
  resolveUsuarioEquipeBadge,
  usuarioEquipeTag,
} from "./usuario-equipe";

const registeredFisio: UserRow = {
  id: "u1",
  nome: "Adriano",
  email: "adriano@test.com",
  created_at: "",
  role: "membro",
  paciente_id: null,
  paciente_nome: null,
  fisioterapeuta_id: "fisio-1",
};

const registeredSecretaria: UserRow = {
  id: "u2",
  nome: "Vitória",
  email: "vitoria@test.com",
  created_at: "",
  role: "recepcao",
  paciente_id: null,
  paciente_nome: null,
  fisioterapeuta_id: null,
};

describe("usuarioEquipeTag", () => {
  it("prioriza dados cadastrados sobre referência admin", () => {
    expect(
      usuarioEquipeTag(
        equipeInputFromUsuarioRow({
          perfil: "admin",
          registered: registeredFisio,
        }),
      ),
    ).toBe("fisio");
  });

  it("usa referência quando usuário ainda não está cadastrado", () => {
    expect(
      usuarioEquipeTag(
        equipeInputFromUsuarioRow({
          perfil: "membro",
          tipoEquipeReferencia: "fisio",
        }),
      ),
    ).toBe("fisio");

    expect(
      usuarioEquipeTag(
        equipeInputFromUsuarioRow({
          perfil: "membro",
          tipoEquipeReferencia: "secretaria",
        }),
      ),
    ).toBe("secretaria");
  });

  it("identifica gestão e admin no banco", () => {
    expect(
      resolveUsuarioEquipeBadge({
        role: "gestao",
      }).tag,
    ).toBe("gestao");

    expect(
      resolveUsuarioEquipeBadge({
        role: "admin",
      }).tag,
    ).toBe("admin");
  });

  it("membro sem vínculo de fisio permanece membro", () => {
    expect(
      usuarioEquipeTag({
        role: "membro",
        fisioterapeutaId: null,
      }),
    ).toBe("membro");
  });
});

describe("cadastroPerfilFromUsuarioRow", () => {
  it("mapeia secretária cadastrada", () => {
    expect(
      cadastroPerfilFromUsuarioRow({
        perfil: "membro",
        registered: registeredSecretaria,
      }),
    ).toBe("secretaria");
  });
});
