import type { PrimaryRole } from "./permissions";

export type MenuKey =
  | "app.dashboard"
  | "app.pacientes"
  | "app.prontuario"
  | "app.agenda"
  | "fin.cobrancas"
  | "fin.notas-fiscais"
  | "fin.financeiro"
  | "fin.relatorios"
  | "team.fisios"
  | "team.usuarios"
  | "cfg.geral"
  | "cfg.convenios"
  | "cfg.instrumentos"
  | "cfg.templates";

export type MenuItemDef = {
  key: MenuKey;
  to: string;
  label: string;
  /** Itens exibidos como submenu deste item na sidebar. */
  children?: MenuItemDef[];
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
      { key: "app.agenda", to: "/app/agenda", label: "Agenda" },
      {
        key: "app.pacientes",
        to: "/app/pacientes",
        label: "Pacientes",
        children: [{ key: "app.prontuario", to: "/app/prontuario", label: "Prontuário" }],
      },
    ],
  },
  {
    id: "fin",
    label: "Financeiro",
    items: [
      {
        key: "fin.financeiro",
        to: "/app/financeiro",
        label: "Análises",
        children: [{ key: "fin.relatorios", to: "/app/relatorios", label: "Relatórios" }],
      },
      { key: "fin.cobrancas", to: "/app/cobrancas", label: "Cobranças" },
      { key: "fin.notas-fiscais", to: "/app/notas-fiscais", label: "Notas Fiscais" },
    ],
  },
  {
    id: "team",
    label: "Equipe",
    items: [
      {
        key: "team.usuarios",
        to: "/app/usuarios",
        label: "Usuários",
        children: [{ key: "team.fisios", to: "/app/fisios", label: "Fisioterapeutas" }],
      },
    ],
  },
  {
    id: "cfg",
    label: "Configurações",
    items: [
      {
        key: "cfg.geral",
        to: "/app/configuracoes/convenios",
        label: "Configurações",
        children: [
          { key: "cfg.convenios", to: "/app/configuracoes/convenios", label: "Convênios" },
          { key: "cfg.instrumentos", to: "/app/configuracoes/instrumentos", label: "Instrumentos" },
          { key: "cfg.templates", to: "/app/configuracoes/templates", label: "Templates" },
        ],
      },
    ],
  },
];

/** Achata itens e seus submenus preservando a ordem de exibição. */
export function flattenMenuItems(items: MenuItemDef[]): MenuItemDef[] {
  return items.flatMap((item) => [item, ...flattenMenuItems(item.children ?? [])]);
}

export const ALL_MENU_KEYS: MenuKey[] = MENU_GROUPS.flatMap((g) =>
  flattenMenuItems(g.items).map((i) => i.key),
);

export const DEFAULT_MENU_FOR_MEMBRO: Record<MenuKey, boolean> = {
  "app.dashboard": true,
  "app.pacientes": true,
  "app.prontuario": true,
  "app.agenda": true,
  "fin.cobrancas": false,
  "fin.notas-fiscais": false,
  "fin.financeiro": false,
  "fin.relatorios": false,
  "team.fisios": true,
  "team.usuarios": false,
  "cfg.geral": false,
  "cfg.convenios": false,
  "cfg.instrumentos": false,
  "cfg.templates": false,
};

/** Menu padrão do fisioterapeuta (visão clínica filtrada). */
export const DEFAULT_MENU_FOR_FISIO: Record<MenuKey, boolean> = {
  ...DEFAULT_MENU_FOR_MEMBRO,
  "team.fisios": false,
};

/** Padrão sugerido para equipe operacional (secretaria/gestão) — admin pode ajustar. */
export const DEFAULT_MENU_FOR_OPERACIONAL: Record<MenuKey, boolean> = {
  "app.dashboard": true,
  "app.pacientes": true,
  "app.prontuario": true,
  "app.agenda": true,
  "fin.cobrancas": true,
  "fin.notas-fiscais": false,
  "fin.financeiro": false,
  "fin.relatorios": false,
  "team.fisios": true,
  "team.usuarios": false,
  "cfg.geral": false,
  "cfg.convenios": true,
  "cfg.instrumentos": false,
  "cfg.templates": false,
};

/** Rótulos do menu lateral quando o usuário é fisio (dados filtrados por paciente). */
export const FISIO_MENU_LABELS: Partial<Record<MenuKey, string>> = {
  "app.pacientes": "Meus pacientes",
  "app.prontuario": "Prontuário",
  "app.agenda": "Minha agenda",
};

export const FISIO_MENU_GROUP_LABELS: Partial<Record<string, string>> = {
  op: "Minha clínica",
};

export const FISIO_MENU_SCOPE_LINES = [
  "Pacientes sob sua responsabilidade ou atendimento",
  "Sessões e relatórios desses pacientes",
  "Agenda da sua coluna e dos seus pacientes",
] as const;

export function menuLabel(key: MenuKey): string {
  for (const group of MENU_GROUPS) {
    const item = flattenMenuItems(group.items).find((i) => i.key === key);
    if (item) return `${group.label} · ${item.label}`;
  }
  return key;
}

export function resolveMenuAccess(
  role: PrimaryRole,
  permissions: Partial<Record<MenuKey, boolean>>,
  defaults: Record<MenuKey, boolean> = DEFAULT_MENU_FOR_MEMBRO,
): Set<MenuKey> {
  if (role === "admin") return new Set(ALL_MENU_KEYS);
  const enabled = new Set<MenuKey>();
  for (const key of ALL_MENU_KEYS) {
    const value = permissions[key] ?? defaults[key] ?? false;
    if (value) enabled.add(key);
  }
  return enabled;
}
