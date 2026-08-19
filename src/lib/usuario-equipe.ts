import type { PrimaryRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/types";
import type { UserRow } from "@/lib/queries/usuarios";

type BrandBadgeTone =
  | "particular"
  | "judicial"
  | "convenio"
  | "puc"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

/** Tags de exibição — legado (secretaria/gestao/membro) mantido para usuários existentes. */
export type UsuarioEquipeTag = "admin" | "fisio" | "secretaria" | "gestao" | "cliente" | "membro";

export type UsuarioEquipeBadge = {
  tag: UsuarioEquipeTag;
  label: string;
  tone: BrandBadgeTone;
};

const BADGE: Record<UsuarioEquipeTag, Omit<UsuarioEquipeBadge, "tag">> = {
  admin: { label: "Administrador", tone: "info" },
  fisio: { label: "Fisioterapeuta", tone: "particular" },
  secretaria: { label: "Secretária", tone: "convenio" },
  gestao: { label: "Gestão", tone: "warning" },
  cliente: { label: "Cliente", tone: "neutral" },
  membro: { label: "Membro", tone: "success" },
};

export function isSecretariaReferencia(observacao?: string): boolean {
  return !!observacao?.toLowerCase().includes("secretaria");
}

/** Perfis disponíveis no cadastro (admin, fisio, cliente + equipe operacional). */
export type UsuarioCadastroPerfil = "admin" | "fisio" | "cliente" | "operacional";

export type UsuarioDisplayPerfil = UsuarioCadastroPerfil;

export type UsuarioDisplayBadge = {
  tag: UsuarioDisplayPerfil;
  label: string;
  tone: BrandBadgeTone;
};

export type UsuarioEquipeRowInput = {
  role: AppRole | null | undefined;
  fisioterapeutaId?: string | null;
  perfilReferencia?: PrimaryRole | "fisio";
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
};

const DISPLAY_BADGE: Record<UsuarioDisplayPerfil, Omit<UsuarioDisplayBadge, "tag">> = {
  admin: { label: "Administrador", tone: "info" },
  fisio: { label: "Fisioterapeuta", tone: "particular" },
  cliente: { label: "Cliente", tone: "neutral" },
  operacional: { label: "Equipe", tone: "convenio" },
};

function refPerfilFromRow(
  perfil: PrimaryRole | "fisio" | "cliente" | "operacional",
): PrimaryRole | "fisio" | undefined {
  if (perfil === "fisio") return "fisio";
  if (perfil === "admin" || perfil === "cliente") return perfil;
  if (perfil === "operacional") return "membro";
  return undefined;
}

export const USUARIO_CADASTRO_PERFIL_OPTIONS: { value: UsuarioCadastroPerfil; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "operacional", label: "Equipe (acessos)" },
  { value: "fisio", label: "Fisioterapeuta" },
  { value: "cliente", label: "Cliente" },
];

export function cadastroPerfilFromEquipeTag(tag: UsuarioEquipeTag): UsuarioCadastroPerfil {
  if (tag === "cliente") return "cliente";
  if (tag === "fisio") return "fisio";
  if (tag === "admin") return "admin";
  if (tag === "secretaria" || tag === "gestao" || tag === "membro") return "operacional";
  return "fisio";
}

export function cadastroPerfilFromUsuarioRow(row: {
  perfil: PrimaryRole | "fisio" | "cliente" | "operacional";
  registered?: UserRow | undefined;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
}): UsuarioCadastroPerfil {
  return usuarioDisplayPerfilFromRow(row);
}

export type UsuarioPerfilFilter = "todos" | "admin" | "fisio" | "cliente" | "operacional";

export const USUARIO_PERFIL_FILTER_OPTIONS: { value: UsuarioPerfilFilter; label: string }[] = [
  { value: "todos", label: "Todos os perfis" },
  { value: "admin", label: "Administrador" },
  { value: "operacional", label: "Equipe" },
  { value: "fisio", label: "Fisioterapeuta" },
  { value: "cliente", label: "Cliente" },
];

export function equipeInputFromUsuarioRow(row: {
  perfil: PrimaryRole | "fisio" | "cliente" | "operacional";
  registered?: UserRow | undefined;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
}): UsuarioEquipeRowInput {
  const refInput: UsuarioEquipeRowInput = {
    role:
      row.perfil === "fisio"
        ? "membro"
        : row.perfil === "operacional"
          ? "membro"
          : (row.perfil as AppRole),
    fisioterapeutaId: null,
    perfilReferencia: refPerfilFromRow(row.perfil),
    tipoEquipeReferencia: row.tipoEquipeReferencia,
    observacaoReferencia: row.observacaoReferencia,
  };

  if (!row.registered) return refInput;

  const regInput: UsuarioEquipeRowInput = {
    role: row.registered.role,
    fisioterapeutaId: row.registered.fisioterapeuta_id,
  };

  const regTag = usuarioEquipeTag(regInput);
  if (regTag === "membro" || regTag === "secretaria" || regTag === "gestao") {
    return {
      ...regInput,
      perfilReferencia: refInput.perfilReferencia,
      tipoEquipeReferencia: refInput.tipoEquipeReferencia,
      observacaoReferencia: refInput.observacaoReferencia,
    };
  }

  return regInput;
}

export function usuarioDisplayPerfilFromRow(row: {
  perfil: PrimaryRole | "fisio" | "cliente" | "operacional";
  registered?: UserRow | undefined;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
}): UsuarioDisplayPerfil {
  if (row.registered) {
    const role = row.registered.role;
    if (role === "admin") return "admin";
    if (role === "cliente" || role === "paciente") return "cliente";
    if (row.registered.fisioterapeuta_id || role === "fisio") return "fisio";
    if (role === "recepcao" || role === "gestao" || role === "membro") return "operacional";
  }

  if (
    row.perfil === "admin" ||
    row.perfil === "fisio" ||
    row.perfil === "cliente" ||
    row.perfil === "operacional"
  ) {
    return row.perfil;
  }

  return usuarioFilterTag(usuarioEquipeTag(equipeInputFromUsuarioRow(row)));
}

export function resolveUsuarioDisplayBadge(row: {
  perfil: PrimaryRole | "fisio" | "cliente" | "operacional";
  registered?: UserRow | undefined;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
}): UsuarioDisplayBadge {
  const display = usuarioDisplayPerfilFromRow(row);
  return { tag: display, ...DISPLAY_BADGE[display] };
}

export function usuarioEquipeTag(input: UsuarioEquipeRowInput): UsuarioEquipeTag {
  return resolveUsuarioEquipeBadge(input).tag;
}

export function resolveUsuarioEquipeBadge(input: UsuarioEquipeRowInput): UsuarioEquipeBadge {
  const role = input.role ?? null;

  if (role === "admin" || input.perfilReferencia === "admin") {
    return { tag: "admin", ...BADGE.admin };
  }
  if (role === "cliente" || role === "paciente" || input.perfilReferencia === "cliente") {
    return { tag: "cliente", ...BADGE.cliente };
  }
  if (
    role === "recepcao" ||
    input.tipoEquipeReferencia === "secretaria" ||
    isSecretariaReferencia(input.observacaoReferencia)
  ) {
    return { tag: "secretaria", ...BADGE.secretaria };
  }
  if (role === "gestao") {
    return { tag: "gestao", ...BADGE.gestao };
  }
  if (
    role === "fisio" ||
    !!input.fisioterapeutaId ||
    input.tipoEquipeReferencia === "fisio" ||
    input.perfilReferencia === "fisio"
  ) {
    return { tag: "fisio", ...BADGE.fisio };
  }
  return { tag: "membro", ...BADGE.membro };
}

export function equipeBadgeFromUserRow(user: UserRow | undefined): UsuarioEquipeBadge | null {
  if (!user) return null;
  return resolveUsuarioEquipeBadge({
    role: user.role,
    fisioterapeutaId: user.fisioterapeuta_id,
  });
}

/** Mapeia tag legada ou atual para filtro simplificado. */
export function usuarioFilterTag(tag: UsuarioEquipeTag): Exclude<UsuarioPerfilFilter, "todos"> {
  if (tag === "cliente") return "cliente";
  if (tag === "fisio") return "fisio";
  if (tag === "membro" || tag === "secretaria" || tag === "gestao") return "operacional";
  return "admin";
}
