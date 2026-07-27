import type { AppRole } from "./types";

/** Papéis legados ainda presentes no banco — tratados como membro na UI. */
export const LEGACY_MEMBRO_ROLES = ["gestao", "recepcao", "fisio"] as const;

export type PrimaryRole = "admin" | "membro" | "cliente";

export const PRIMARY_ROLES: PrimaryRole[] = ["admin", "membro", "cliente"];

export const ROLE_LABELS: Record<PrimaryRole, string> = {
  admin: "Administrador",
  membro: "Membro",
  cliente: "Cliente",
};

export function normalizeRole(role: AppRole | null | undefined): PrimaryRole | null {
  if (!role) return null;
  if (role === "admin" || role === "cliente") return role;
  if (
    role === "membro" ||
    LEGACY_MEMBRO_ROLES.includes(role as (typeof LEGACY_MEMBRO_ROLES)[number])
  ) {
    return "membro";
  }
  if (role === "paciente") return "cliente";
  return null;
}

export function hasRole(
  roles: AppRole[],
  required: AppRole | AppRole[] | PrimaryRole | PrimaryRole[],
): boolean {
  const list = Array.isArray(required) ? required : [required];
  return list.some((r) => {
    if (r === "membro") {
      return roles.some((ur) => normalizeRole(ur) === "membro");
    }
    if (r === "cliente") {
      return roles.includes("cliente") || roles.includes("paciente");
    }
    return roles.includes(r as AppRole);
  });
}

export function isStaff(roles: AppRole[]): boolean {
  return (
    hasRole(roles, ["admin", "membro"]) ||
    roles.some((r) => LEGACY_MEMBRO_ROLES.includes(r as (typeof LEGACY_MEMBRO_ROLES)[number]))
  );
}

export function isCliente(roles: AppRole[]): boolean {
  return hasRole(roles, "cliente");
}

/** Fisio clínico — visão filtrada por paciente (papel fisio ou membro vinculado ao cadastro). */
export function isFisioScopedUser(roles: AppRole[], fisioterapeutaId?: string | null): boolean {
  if (roles.includes("admin") || roles.includes("gestao") || roles.includes("recepcao")) {
    return false;
  }
  if (roles.includes("fisio")) return true;
  return roles.includes("membro") && !!fisioterapeutaId;
}

/** Membro operacional (recepção/gestão legada) sem vínculo de fisio clínico. */
export function isOperationalMembro(roles: AppRole[], fisioterapeutaId?: string | null): boolean {
  return roles.includes("membro") && !fisioterapeutaId && !roles.includes("admin");
}

export const can = {
  manageUsers: (roles: AppRole[]) => hasRole(roles, "admin"),
  viewFinance: (roles: AppRole[], fisioterapeutaId?: string | null) => {
    if (isFisioScopedUser(roles, fisioterapeutaId)) return false;
    return (
      hasRole(roles, "admin") ||
      hasRole(roles, ["gestao", "recepcao"]) ||
      isOperationalMembro(roles, fisioterapeutaId)
    );
  },
  editProntuario: (roles: AppRole[]) => hasRole(roles, ["admin", "membro", "fisio"]),
  removePeriodizacaoPdf: (roles: AppRole[]) => hasRole(roles, ["admin", "gestao"]),
  removeRelatorioAtendimentoPdf: (roles: AppRole[]) => hasRole(roles, ["admin", "gestao"]),
  deleteRelatorioAtendimento: (roles: AppRole[]) => hasRole(roles, ["admin", "gestao"]),
  manageAgenda: (roles: AppRole[], fisioterapeutaId?: string | null) =>
    hasRole(roles, ["admin", "gestao", "recepcao"]) || isOperationalMembro(roles, fisioterapeutaId),
  /** Cadastro administrativo — recepção/admin; fisio clínico não cadastra pacientes. */
  managePacientes: (roles: AppRole[], fisioterapeutaId?: string | null) =>
    hasRole(roles, "admin") ||
    hasRole(roles, ["gestao", "recepcao"]) ||
    isOperationalMembro(roles, fisioterapeutaId),
  manageFisios: (roles: AppRole[], fisioterapeutaId?: string | null) => {
    if (isFisioScopedUser(roles, fisioterapeutaId)) return false;
    return (
      hasRole(roles, "admin") ||
      hasRole(roles, ["gestao", "recepcao"]) ||
      isOperationalMembro(roles, fisioterapeutaId)
    );
  },
  accessApp: (roles: AppRole[]) => isStaff(roles),
};
