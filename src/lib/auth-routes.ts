import { supabase } from "@/integrations/supabase/client";

/** Destino após login ou refresh na raiz (`/`). */
export async function resolvePostAuthPath(userId: string): Promise<"/app" | "/portal"> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roleList = (roles ?? []).map((r) => r.role);

  if (roleList.includes("cliente")) return "/portal";

  const staffRoles = new Set(["admin", "membro", "gestao", "recepcao", "fisio"]);
  if (roleList.some((r) => staffRoles.has(r))) return "/app";

  const { data: pac } = await (supabase as any)
    .from("pacientes")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return pac ? "/portal" : "/app";
}
