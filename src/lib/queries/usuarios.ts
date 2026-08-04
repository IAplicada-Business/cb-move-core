import { invokeEdgeFunction } from "@/lib/edge-functions";
import { supabase } from "@/integrations/supabase/client";
import type { MenuKey } from "@/lib/menu-access";
import type { PrimaryRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/types";
import type { UsuarioCadastroPerfil } from "@/lib/usuario-equipe";

export type UserRow = {
  id: string;
  nome: string | null;
  email: string | null;
  created_at: string;
  role: AppRole | null;
  paciente_id: string | null;
  paciente_nome: string | null;
  fisioterapeuta_id: string | null;
};

export async function fetchUsers(): Promise<UserRow[]> {
  try {
    const { data, error } = await supabase.rpc("list_users");
    if (!error && Array.isArray(data)) return sortUsers(data as UserRow[]);
  } catch {
    /* RPC ainda não migrada */
  }

  try {
    const edge = await invokeEdgeFunction<{ users: UserRow[] }>("list-users", {});
    if (Array.isArray(edge.users)) return sortUsers(edge.users);
  } catch {
    /* edge function indisponível ou lenta */
  }

  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, created_at, fisioterapeuta_id")
      .order("nome"),
    supabase.from("user_roles").select("user_id, role, created_at"),
  ]);

  if (pErr) throw pErr;
  if (rErr) throw rErr;

  const roleMap = new Map<string, AppRole>();
  for (const r of roles ?? []) {
    const existing = roleMap.get(r.user_id);
    if (!existing) {
      roleMap.set(r.user_id, r.role as AppRole);
    }
  }

  const byId = new Map<string, UserRow>();
  for (const p of profiles ?? []) {
    byId.set(p.id, {
      ...p,
      role: roleMap.get(p.id) ?? null,
      paciente_id: null,
      paciente_nome: null,
      fisioterapeuta_id: p.fisioterapeuta_id ?? null,
    });
  }

  for (const r of roles ?? []) {
    if (!byId.has(r.user_id)) {
      byId.set(r.user_id, {
        id: r.user_id,
        nome: null,
        email: null,
        created_at: r.created_at,
        role: r.role as AppRole,
        paciente_id: null,
        paciente_nome: null,
        fisioterapeuta_id: null,
      });
    }
  }

  return sortUsers(Array.from(byId.values()));
}

function sortUsers(users: UserRow[]): UserRow[] {
  return [...users].sort((a, b) => {
    const aAdmin = a.email === "mariana@iaplicada.com" || a.role === "admin";
    const bAdmin = b.email === "mariana@iaplicada.com" || b.role === "admin";
    if (aAdmin && !bAdmin) return -1;
    if (!aAdmin && bAdmin) return 1;
    return (a.nome ?? a.email ?? "").localeCompare(b.nome ?? b.email ?? "", "pt-BR");
  });
}

export async function updateUserRole(userId: string, role: PrimaryRole) {
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

export type CreateUserInput = {
  email: string;
  nome: string;
  perfil: UsuarioCadastroPerfil;
  paciente_id?: string | null;
};

export async function createUser(input: CreateUserInput) {
  return invokeEdgeFunction<{ ok: boolean; message: string; user_id?: string; created?: boolean }>(
    "create-user",
    input,
  );
}

export async function deleteUser(userId: string) {
  return invokeEdgeFunction<{ ok: boolean; message: string }>("delete-user", { user_id: userId });
}

export async function fetchMenuPermissions(
  role: PrimaryRole,
): Promise<Partial<Record<MenuKey, boolean>>> {
  const { data, error } = await supabase
    .from("menu_permissions")
    .select("menu_key, enabled")
    .eq("role", role);
  if (error) throw error;

  const map: Partial<Record<MenuKey, boolean>> = {};
  for (const row of data ?? []) {
    map[row.menu_key as MenuKey] = row.enabled;
  }
  return map;
}

export async function saveMenuPermissions(
  role: PrimaryRole,
  permissions: Partial<Record<MenuKey, boolean>>,
) {
  const rows = Object.entries(permissions).map(([menu_key, enabled]) => ({
    role,
    menu_key,
    enabled: !!enabled,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("menu_permissions").upsert(rows, {
    onConflict: "role,menu_key",
  });
  if (error) throw error;
}
