import { describe, expect, it } from "vitest";

import type { UserRow } from "@/lib/queries/usuarios";

import {
  cadastroPerfilFromEquipeTag,
  cadastroPerfilFromUsuarioRow,
  equipeInputFromUsuarioRow,
  resolveUsuarioEquipeBadge,
  usuarioDisplayPerfilFromRow,
  usuarioEquipeTag,
  usuarioFilterTag,
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

const registeredMembroSemFisio: UserRow = {
  id: "u3",
  nome: "Brenda",
  email: "brenda@test.com",
  created_at: "",
  role: "membro",
  paciente_id: null,
  paciente_nome: null,
  fisioterapeuta_id: null,
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
          perfil: "fisio",
        }),
      ),
    ).toBe("fisio");

    expect(
      usuarioEquipeTag(
        equipeInputFromUsuarioRow({
          perfil: "admin",
        }),
      ),
    ).toBe("admin");
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

  it("usa referência fisio quando cadastro no banco é membro genérico", () => {
    expect(
      usuarioDisplayPerfilFromRow({
        perfil: "fisio",
        registered: registeredMembroSemFisio,
      }),
    ).toBe("fisio");
  });

  it("membro sem fisio usa referência admin quando cadastro ainda não reflete admin", () => {
    expect(
      usuarioDisplayPerfilFromRow({
        perfil: "admin",
        registered: registeredMembroSemFisio,
      }),
    ).toBe("admin");
  });

  it("membro sem referência clara assume perfil clínico", () => {
    expect(
      usuarioDisplayPerfilFromRow({
        perfil: "membro",
        registered: registeredMembroSemFisio,
      }),
    ).toBe("fisio");
  });

  it("prioriza role cadastrada para KPI e tags", () => {
    expect(
      usuarioDisplayPerfilFromRow({
        perfil: "fisio",
        registered: {
          ...registeredFisio,
          role: "admin",
        },
      }),
    ).toBe("admin");
  });
});

describe("cadastroPerfilFromUsuarioRow", () => {
  it("mapeia secretária cadastrada para admin quando referência é admin", () => {
    expect(
      cadastroPerfilFromUsuarioRow({
        perfil: "admin",
        registered: registeredSecretaria,
      }),
    ).toBe("admin");
  });

  it("mapeia fisio cadastrado", () => {
    expect(
      cadastroPerfilFromUsuarioRow({
        perfil: "fisio",
        registered: registeredFisio,
      }),
    ).toBe("fisio");
  });
});

describe("usuarioFilterTag", () => {
  it("agrupa tags legadas em admin, fisio ou cliente", () => {
    expect(usuarioFilterTag("secretaria")).toBe("admin");
    expect(usuarioFilterTag("gestao")).toBe("admin");
    expect(usuarioFilterTag("membro")).toBe("fisio");
    expect(usuarioFilterTag("fisio")).toBe("fisio");
    expect(usuarioFilterTag("cliente")).toBe("cliente");
  });
});

describe("cadastroPerfilFromEquipeTag", () => {
  it("reduz tags legadas aos três perfis de cadastro", () => {
    expect(cadastroPerfilFromEquipeTag("secretaria")).toBe("admin");
    expect(cadastroPerfilFromEquipeTag("gestao")).toBe("admin");
    expect(cadastroPerfilFromEquipeTag("membro")).toBe("fisio");
  });
});
