import { supabase } from "@/integrations/supabase/client";
import { diag } from "@/lib/client-diagnostics";
import type { PostAuthPath } from "@/lib/password-reset";
import { isStaff } from "@/lib/permissions";
import type { AppRole } from "@/lib/types";

/** Destino pós-login a partir de papéis já carregados (testável sem Supabase). */
export function resolvePostAuthPathFromRoles(
  roleList: AppRole[],
  hasPacienteLink: boolean,
): PostAuthPath {
  if (roleList.includes("cliente")) return "/portal";
  if (isStaff(roleList)) return "/app";
  if (hasPacienteLink) return "/portal";
  return "/sem-acesso";
}

/** Destino após login ou refresh na raiz (`/`). */
export async function resolvePostAuthPath(userId: string): Promise<PostAuthPath> {
  diag.info("routing", "resolvendo destino pós-auth", { userId });

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesError) {
    diag.error("routing", "falha ao buscar papéis para redirect", rolesError);
    throw rolesError;
  }

  const roleList = (roles ?? []).map((r) => r.role);

  if (roleList.includes("cliente")) {
    diag.info("routing", "redirect → /portal (cliente)");
    return "/portal";
  }

  if (isStaff(roleList)) {
    diag.info("routing", "redirect → /app (equipe)", { roles: roleList });
    return "/app";
  }

  const { data: pac, error: pacError } = await supabase
    .from("pacientes")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (pacError) {
    diag.error("routing", "falha ao buscar paciente para redirect", pacError);
    throw pacError;
  }

  const path = resolvePostAuthPathFromRoles(roleList, Boolean(pac));
  if (path === "/portal" && pac) {
    diag.info("routing", "redirect → /portal (paciente vinculado)", {
      pacienteId: pac.id,
      roles: roleList,
    });
  } else if (path === "/sem-acesso") {
    diag.info("routing", "redirect → /sem-acesso (sem papel)", { roles: roleList });
  }
  return path;
}
