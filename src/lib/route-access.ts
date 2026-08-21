import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import {
  getCachedAccessContext,
  syncAccessContext as storeAccessContext,
  type AccessContext,
} from "@/lib/access-context";
import {
  ALL_MENU_KEYS,
  DEFAULT_MENU_FOR_FISIO,
  DEFAULT_MENU_FOR_MEMBRO,
  DEFAULT_MENU_FOR_OPERACIONAL,
  type MenuKey,
} from "@/lib/menu-access";
import {
  can,
  hasRole,
  isAdminUser,
  isFisioScopedUser,
  isOperationalMembro,
  normalizeRole,
  type PrimaryRole,
} from "@/lib/permissions";
import type { AppRole } from "@/lib/types";

const FINANCE_MENU_KEYS: MenuKey[] = [
  "fin.financeiro",
  "fin.relatorios",
  "fin.cobrancas",
  "fin.notas-fiscais",
];

const CONFIG_MENU_KEYS: MenuKey[] = [
  "cfg.geral",
  "cfg.convenios",
  "cfg.instrumentos",
  "cfg.templates",
];

async function loadAccessContext(options?: {
  bypassCache?: boolean;
}): Promise<AccessContext | null> {
  if (!options?.bypassCache) {
    const cached = getCachedAccessContext();
    if (cached) return cached;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const [rolesRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", session.user.id),
    supabase.from("profiles").select("fisioterapeuta_id").eq("id", session.user.id).maybeSingle(),
  ]);

  const ctx: AccessContext = {
    roles: (rolesRes.data ?? []).map((row) => row.role as AppRole),
    fisioterapeutaId: profileRes.data?.fisioterapeuta_id ?? null,
  };
  storeAccessContext(ctx);
  return ctx;
}

async function loadUserMenuEnabled(userId: string): Promise<Partial<Record<MenuKey, boolean>>> {
  const { data, error } = await supabase
    .from("user_menu_permissions")
    .select("menu_key, enabled")
    .eq("user_id", userId);
  if (error) return {};
  const map: Partial<Record<MenuKey, boolean>> = {};
  for (const row of data ?? []) {
    if (ALL_MENU_KEYS.includes(row.menu_key as MenuKey)) {
      map[row.menu_key as MenuKey] = row.enabled;
    }
  }
  return map;
}

async function loadRoleMenuEnabled(role: PrimaryRole): Promise<Partial<Record<MenuKey, boolean>>> {
  const { data, error } = await supabase
    .from("menu_permissions")
    .select("menu_key, enabled")
    .eq("role", role);
  if (error) return {};
  const map: Partial<Record<MenuKey, boolean>> = {};
  for (const row of data ?? []) {
    if (ALL_MENU_KEYS.includes(row.menu_key as MenuKey)) {
      map[row.menu_key as MenuKey] = row.enabled;
    }
  }
  return map;
}

function hasAnyMenu(
  permissions: Partial<Record<MenuKey, boolean>>,
  keys: MenuKey[],
  defaults: Record<MenuKey, boolean>,
): boolean {
  return keys.some((key) => permissions[key] ?? defaults[key] ?? false);
}

function menuKeyEnabled(
  menuKey: MenuKey,
  permissions: Partial<Record<MenuKey, boolean>>,
  defaults: Record<MenuKey, boolean>,
): boolean {
  return permissions[menuKey] ?? defaults[menuKey] ?? false;
}

async function resolveMenuPermissions(ctx: AccessContext): Promise<{
  permissions: Partial<Record<MenuKey, boolean>>;
  defaults: Record<MenuKey, boolean>;
}> {
  if (isFisioScopedUser(ctx.roles, ctx.fisioterapeutaId)) {
    return { permissions: {}, defaults: DEFAULT_MENU_FOR_FISIO };
  }

  if (isOperationalMembro(ctx.roles, ctx.fisioterapeutaId)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { permissions: {}, defaults: DEFAULT_MENU_FOR_OPERACIONAL };
    const permissions = await loadUserMenuEnabled(session.user.id);
    return { permissions, defaults: DEFAULT_MENU_FOR_OPERACIONAL };
  }

  const primary = normalizeRole(ctx.roles[0]) ?? "membro";
  const defaults = DEFAULT_MENU_FOR_MEMBRO;
  if (primary === "membro") {
    const permissions = await loadRoleMenuEnabled("membro");
    return { permissions, defaults };
  }

  return { permissions: {}, defaults };
}

async function isMenuEnabled(ctx: AccessContext, menuKey: MenuKey): Promise<boolean> {
  if (isAdminUser(ctx.roles)) return true;
  const { permissions, defaults } = await resolveMenuPermissions(ctx);
  return menuKeyEnabled(menuKey, permissions, defaults);
}

/** Bloqueia acesso quando o menu key não está liberado para o perfil atual. */
export async function assertMenuAccess(menuKey: MenuKey): Promise<void> {
  const ctx = await loadAccessContext();
  if (!ctx) throw redirect({ to: "/login" });

  if (FINANCE_MENU_KEYS.includes(menuKey) && !can.viewFinance(ctx.roles, ctx.fisioterapeutaId)) {
    throw redirect({ to: "/app" });
  }

  if (!(await isMenuEnabled(ctx, menuKey))) {
    throw redirect({ to: "/app" });
  }
}

/**
 * Bloqueia fisio clínico e demais perfis sem permissão financeira.
 * Equipe operacional só entra se tiver algum módulo fin.* liberado.
 */
export async function assertFinanceAccess(): Promise<void> {
  const ctx = await loadAccessContext();
  if (!ctx) throw redirect({ to: "/login" });
  if (!can.viewFinance(ctx.roles, ctx.fisioterapeutaId)) {
    throw redirect({ to: "/app" });
  }

  if (isOperationalMembro(ctx.roles, ctx.fisioterapeutaId)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const menus = await loadUserMenuEnabled(session.user.id);
    if (!hasAnyMenu(menus, FINANCE_MENU_KEYS, DEFAULT_MENU_FOR_MEMBRO)) {
      throw redirect({ to: "/app" });
    }
  }
}

/** Gestão de usuários — somente administrador. */
export async function assertAdminAccess(): Promise<void> {
  const ctx = await loadAccessContext();
  if (!ctx) throw redirect({ to: "/login" });
  if (!can.manageUsers(ctx.roles)) {
    throw redirect({ to: "/app" });
  }
}

/** Configurações do sistema — admin ou membro operacional com módulo cfg.* liberado. */
export async function assertConfigAccess(): Promise<void> {
  const ctx = await loadAccessContext();
  if (!ctx) throw redirect({ to: "/login" });

  if (isFisioScopedUser(ctx.roles, ctx.fisioterapeutaId)) {
    throw redirect({ to: "/app" });
  }

  if (isAdminUser(ctx.roles) || hasRole(ctx.roles, ["gestao", "recepcao"])) {
    return;
  }

  if (isOperationalMembro(ctx.roles, ctx.fisioterapeutaId)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const menus = await loadUserMenuEnabled(session.user.id);
    if (!hasAnyMenu(menus, CONFIG_MENU_KEYS, DEFAULT_MENU_FOR_OPERACIONAL)) {
      throw redirect({ to: "/app" });
    }
    return;
  }

  throw redirect({ to: "/app" });
}

/** Cadastro/gestão da equipe de fisioterapeutas. */
export async function assertFisiosAccess(): Promise<void> {
  const ctx = await loadAccessContext();
  if (!ctx) throw redirect({ to: "/login" });
  if (!can.manageFisios(ctx.roles, ctx.fisioterapeutaId)) {
    throw redirect({ to: "/app" });
  }

  if (isOperationalMembro(ctx.roles, ctx.fisioterapeutaId)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const menus = await loadUserMenuEnabled(session.user.id);
    if (!(menus["team.fisios"] ?? DEFAULT_MENU_FOR_MEMBRO["team.fisios"])) {
      throw redirect({ to: "/app" });
    }
  }
}
