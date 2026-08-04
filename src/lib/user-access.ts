import {
  ALL_MENU_KEYS,
  DEFAULT_MENU_FOR_FISIO,
  DEFAULT_MENU_FOR_MEMBRO,
  type MenuKey,
} from "@/lib/menu-access";
import type { AppRole } from "@/lib/types";

/** Papéis configuráveis na aba Usuários (UI). */
export type OperationalRoleUi = "admin" | "secretaria" | "gestao" | "fisio" | "cliente";

export const OPERATIONAL_ROLE_LABELS: Record<OperationalRoleUi, string> = {
  admin: "Administrador",
  secretaria: "Secretária / Recepção",
  gestao: "Gestão",
  fisio: "Fisioterapeuta",
  cliente: "Cliente (portal)",
};

export const OPERATIONAL_ROLE_DESCRIPTIONS: Record<OperationalRoleUi, string> = {
  admin: "Acesso total ao sistema, incluindo usuários e configurações.",
  secretaria:
    "Vê todos os pacientes e a agenda completa. Cadastra pacientes e gerencia agendamentos.",
  gestao: "Como secretária, com permissão financeira e relatórios (conforme menu).",
  fisio: "Vê apenas pacientes vinculados (1º agendamento). Menu clínico filtrado.",
  cliente: "Portal do paciente — histórico, exercícios e documentos próprios.",
};

export const STAFF_OPERATIONAL_ROLES: OperationalRoleUi[] = [
  "admin",
  "secretaria",
  "gestao",
  "fisio",
];

export type MenuAccessPresetId =
  "secretaria" | "secretaria_financeiro" | "operacional_completo" | "fisio" | "gestao";

export type MenuAccessPreset = {
  id: MenuAccessPresetId;
  label: string;
  description: string;
  permissions: Record<MenuKey, boolean>;
};

const fullMembroMenu = (): Record<MenuKey, boolean> => {
  const out = {} as Record<MenuKey, boolean>;
  for (const key of ALL_MENU_KEYS) out[key] = true;
  out["team.usuarios"] = false;
  return out;
};

export const MENU_ACCESS_PRESETS: MenuAccessPreset[] = [
  {
    id: "secretaria",
    label: "Secretária",
    description: "Pacientes, prontuário, agenda e fisios — sem financeiro.",
    permissions: { ...DEFAULT_MENU_FOR_MEMBRO },
  },
  {
    id: "secretaria_financeiro",
    label: "Secretária + Financeiro",
    description: "Operação clínica + cobranças, NFs e relatórios.",
    permissions: {
      ...DEFAULT_MENU_FOR_MEMBRO,
      "fin.cobrancas": true,
      "fin.notas-fiscais": true,
      "fin.financeiro": true,
      "fin.relatorios": true,
    },
  },
  {
    id: "operacional_completo",
    label: "Operacional completo",
    description: "Todo o menu de membro, exceto usuários.",
    permissions: fullMembroMenu(),
  },
  {
    id: "fisio",
    label: "Fisioterapeuta",
    description: "Referência — fisios usam menu clínico fixo (escopo por paciente).",
    permissions: { ...DEFAULT_MENU_FOR_FISIO },
  },
  {
    id: "gestao",
    label: "Gestão",
    description: "Operação + financeiro + configurações de convênios e templates.",
    permissions: {
      ...fullMembroMenu(),
      "cfg.convenios": true,
      "cfg.templates": true,
      "cfg.instrumentos": true,
    },
  },
];

export function appRoleFromOperational(role: OperationalRoleUi): AppRole {
  switch (role) {
    case "admin":
      return "admin";
    case "secretaria":
      return "recepcao";
    case "gestao":
      return "gestao";
    case "fisio":
      return "fisio";
    case "cliente":
      return "cliente";
  }
}

export function operationalRoleFromUser(
  role: AppRole | null | undefined,
  fisioterapeutaId?: string | null,
): OperationalRoleUi {
  if (!role) return "secretaria";
  if (role === "admin") return "admin";
  if (role === "cliente" || role === "paciente") return "cliente";
  if (role === "recepcao") return "secretaria";
  if (role === "gestao") return "gestao";
  if (role === "fisio" || (role === "membro" && fisioterapeutaId)) return "fisio";
  return "secretaria";
}

export function operationalRoleLabel(
  role: AppRole | null | undefined,
  fisioterapeutaId?: string | null,
  fisioterapeutaNome?: string | null,
): string {
  const ui = operationalRoleFromUser(role, fisioterapeutaId);
  if (ui === "fisio" && fisioterapeutaNome) {
    return `${OPERATIONAL_ROLE_LABELS.fisio} · ${fisioterapeutaNome}`;
  }
  return OPERATIONAL_ROLE_LABELS[ui];
}

export function mergeMenuPermissions(
  stored: Partial<Record<MenuKey, boolean>> | undefined,
  defaults: Record<MenuKey, boolean> = DEFAULT_MENU_FOR_MEMBRO,
): Record<MenuKey, boolean> {
  const merged = {} as Record<MenuKey, boolean>;
  for (const key of ALL_MENU_KEYS) {
    merged[key] = stored?.[key] ?? defaults[key] ?? false;
  }
  return merged;
}
