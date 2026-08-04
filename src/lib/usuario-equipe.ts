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

export type UsuarioEquipeRowInput = {
  role: AppRole | null | undefined;
  fisioterapeutaId?: string | null;
  perfilReferencia?: PrimaryRole;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
};

export type UsuarioCadastroPerfil =
  "admin" | "fisio" | "secretaria" | "gestao" | "membro" | "cliente";

export const USUARIO_CADASTRO_PERFIL_OPTIONS: { value: UsuarioCadastroPerfil; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "fisio", label: "Fisioterapeuta" },
  { value: "secretaria", label: "Secretária" },
  { value: "gestao", label: "Gestão" },
  { value: "membro", label: "Membro" },
  { value: "cliente", label: "Cliente" },
];

export function cadastroPerfilFromEquipeTag(tag: UsuarioEquipeTag): UsuarioCadastroPerfil {
  if (tag === "membro") return "membro";
  return tag;
}

export function cadastroPerfilFromUsuarioRow(row: {
  perfil: PrimaryRole;
  registered?: UserRow | undefined;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
}): UsuarioCadastroPerfil {
  return cadastroPerfilFromEquipeTag(usuarioEquipeTag(equipeInputFromUsuarioRow(row)));
}

export function cadastroPerfilHasMenuAccess(perfil: UsuarioCadastroPerfil): boolean {
  return perfil === "secretaria" || perfil === "gestao" || perfil === "membro";
}

export type UsuarioPerfilFilter = "todos" | UsuarioEquipeTag;

export const USUARIO_PERFIL_FILTER_OPTIONS: { value: UsuarioPerfilFilter; label: string }[] = [
  { value: "todos", label: "Todos os perfis" },
  { value: "admin", label: "Administrador" },
  { value: "fisio", label: "Fisioterapeuta" },
  { value: "secretaria", label: "Secretária" },
  { value: "gestao", label: "Gestão" },
  { value: "cliente", label: "Cliente" },
  { value: "membro", label: "Membro" },
];

export function equipeInputFromUsuarioRow(row: {
  perfil: PrimaryRole;
  registered?: UserRow | undefined;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
}): UsuarioEquipeRowInput {
  if (row.registered) {
    return {
      role: row.registered.role,
      fisioterapeutaId: row.registered.fisioterapeuta_id,
    };
  }
  return {
    role: row.perfil as AppRole,
    fisioterapeutaId: null,
    perfilReferencia: row.perfil,
    tipoEquipeReferencia: row.tipoEquipeReferencia,
    observacaoReferencia: row.observacaoReferencia,
  };
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
  if (role === "fisio" || !!input.fisioterapeutaId || input.tipoEquipeReferencia === "fisio") {
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
