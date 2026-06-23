import type { AppRole } from "./types";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  gestao: "Gestão",
  recepcao: "Recepção",
  fisio: "Fisioterapeuta",
};

export function hasRole(roles: AppRole[], required: AppRole | AppRole[]): boolean {
  const list = Array.isArray(required) ? required : [required];
  return list.some((r) => roles.includes(r));
}

export const can = {
  manageUsers: (roles: AppRole[]) => hasRole(roles, "admin"),
  viewFinance: (roles: AppRole[]) => hasRole(roles, ["admin", "gestao"]),
  editProntuario: (roles: AppRole[]) => hasRole(roles, ["admin", "fisio"]),
  manageAgenda: (roles: AppRole[]) => hasRole(roles, ["admin", "gestao", "recepcao"]),
};
