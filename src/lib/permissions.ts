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
  if (role === "membro" || LEGACY_MEMBRO_ROLES.includes(role as (typeof LEGACY_MEMBRO_ROLES)[number])) {
    return "membro";
  }
  if (role === "paciente") return "cliente";
  return null;
}

export function hasRole(roles: AppRole[], required: AppRole | AppRole[] | PrimaryRole | PrimaryRole[]): boolean {
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
  return hasRole(roles, ["admin", "membro"]) ||
    roles.some((r) => LEGACY_MEMBRO_ROLES.includes(r as (typeof LEGACY_MEMBRO_ROLES)[number]));
}

export function isCliente(roles: AppRole[]): boolean {
  return hasRole(roles, "cliente");
}

export const can = {
  manageUsers: (roles: AppRole[]) => hasRole(roles, "admin"),
  viewFinance: (roles: AppRole[]) => hasRole(roles, ["admin", "membro", "gestao"]),
  editProntuario: (roles: AppRole[]) => hasRole(roles, ["admin", "membro", "fisio"]),
  manageAgenda: (roles: AppRole[]) => hasRole(roles, ["admin", "membro", "gestao", "recepcao"]),
  accessApp: (roles: AppRole[]) => isStaff(roles),
};
