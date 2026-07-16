import type { PrimaryRole } from "./permissions";

export type MenuKey =
  | "app.dashboard"
  | "app.pacientes"
  | "app.prontuario"
  | "app.agenda"
  | "fin.cobrancas"
  | "fin.notas-fiscais"
  | "fin.relatorios"
  | "team.fisios"
  | "team.usuarios"
  | "cfg.geral"
  | "cfg.convenios"
  | "cfg.instrumentos"
  | "cfg.templates"
  | "cfg.integracoes"
  | "help.ajuda";

export type MenuItemDef = {
  key: MenuKey;
  to: string;
  label: string;
};

export type MenuGroupDef = {
  id: string;
  label: string;
  items: MenuItemDef[];
};

export const MENU_GROUPS: MenuGroupDef[] = [
  {
    id: "op",
    label: "Operação",
    items: [
      { key: "app.dashboard", to: "/app", label: "Dashboard" },
      { key: "app.pacientes", to: "/app/pacientes", label: "Pacientes" },
      { key: "app.prontuario", to: "/app/prontuario", label: "Prontuário" },
      { key: "app.agenda", to: "/app/agenda", label: "Agenda" },
    ],
  },
  {
    id: "fin",
    label: "Financeiro",
    items: [
      { key: "fin.cobrancas", to: "/app/cobrancas", label: "Cobranças" },
      { key: "fin.notas-fiscais", to: "/app/notas-fiscais", label: "Notas Fiscais" },
      { key: "fin.relatorios", to: "/app/relatorios", label: "Relatórios" },
    ],
  },
  {
    id: "team",
    label: "Equipe",
    items: [
      { key: "team.fisios", to: "/app/fisios", label: "Fisioterapeutas" },
      { key: "team.usuarios", to: "/app/usuarios", label: "Usuários" },
    ],
  },
  {
    id: "cfg",
    label: "Configurações",
    items: [
      { key: "cfg.geral", to: "/app/configuracoes", label: "Geral" },
      { key: "cfg.convenios", to: "/app/configuracoes/convenios", label: "Convênios" },
      { key: "cfg.instrumentos", to: "/app/configuracoes/instrumentos", label: "Instrumentos" },
      { key: "cfg.templates", to: "/app/configuracoes/templates", label: "Templates" },
      { key: "cfg.integracoes", to: "/app/configuracoes/integracoes", label: "Integrações" },
    ],
  },
  {
    id: "ajuda",
    label: "Suporte",
    items: [{ key: "help.ajuda", to: "/app/ajuda", label: "Ajuda" }],
  },
];

export const ALL_MENU_KEYS: MenuKey[] = MENU_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const DEFAULT_MENU_FOR_MEMBRO: Record<MenuKey, boolean> = {
  "app.dashboard": true,
  "app.pacientes": true,
  "app.prontuario": true,
  "app.agenda": true,
  "fin.cobrancas": false,
  "fin.notas-fiscais": false,
  "fin.relatorios": false,
  "team.fisios": true,
  "team.usuarios": false,
  "cfg.geral": false,
  "cfg.convenios": false,
  "cfg.instrumentos": false,
  "cfg.templates": false,
  "cfg.integracoes": false,
  "help.ajuda": true,
};

export function menuLabel(key: MenuKey): string {
  for (const group of MENU_GROUPS) {
    const item = group.items.find((i) => i.key === key);
    if (item) return `${group.label} · ${item.label}`;
  }
  return key;
}

export function resolveMenuAccess(
  role: PrimaryRole,
  permissions: Partial<Record<MenuKey, boolean>>,
): Set<MenuKey> {
  if (role === "admin") return new Set(ALL_MENU_KEYS);
  const enabled = new Set<MenuKey>();
  for (const key of ALL_MENU_KEYS) {
    const value = permissions[key] ?? DEFAULT_MENU_FOR_MEMBRO[key] ?? false;
    if (value) enabled.add(key);
  }
  return enabled;
}
