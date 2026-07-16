import { supabase } from "@/integrations/supabase/client";
import { diag } from "@/lib/client-diagnostics";

/** Destino após login ou refresh na raiz (`/`). */
export async function resolvePostAuthPath(userId: string): Promise<"/app" | "/portal"> {
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

  const staffRoles = new Set(["admin", "membro", "gestao", "recepcao", "fisio"]);
  if (roleList.some((r) => staffRoles.has(r))) {
    diag.info("routing", "redirect → /app (equipe)", { roles: roleList });
    return "/app";
  }

  const { data: pac, error: pacError } = await (supabase as any)
    .from("pacientes")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (pacError) {
    diag.error("routing", "falha ao buscar paciente para redirect", pacError);
    throw pacError;
  }

  const path = pac ? "/portal" : "/app";
  diag.info("routing", `redirect → ${path}`, { pacienteId: pac?.id ?? null, roles: roleList });
  return path;
}
