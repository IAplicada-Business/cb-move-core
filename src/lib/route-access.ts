import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { can } from "@/lib/permissions";
import type { AppRole } from "@/lib/types";

async function loadAccessContext(): Promise<{
  roles: AppRole[];
  fisioterapeutaId: string | null;
} | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const [rolesRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", session.user.id),
    supabase.from("profiles").select("fisioterapeuta_id").eq("id", session.user.id).maybeSingle(),
  ]);

  return {
    roles: (rolesRes.data ?? []).map((row) => row.role as AppRole),
    fisioterapeutaId: profileRes.data?.fisioterapeuta_id ?? null,
  };
}

/** Bloqueia fisio clínico e demais perfis sem permissão financeira. */
export async function assertFinanceAccess(): Promise<void> {
  const ctx = await loadAccessContext();
  if (!ctx) throw redirect({ to: "/login" });
  if (!can.viewFinance(ctx.roles, ctx.fisioterapeutaId)) {
    throw redirect({ to: "/app" });
  }
}

/** Cadastro/gestão da equipe de fisioterapeutas. */
export async function assertFisiosAccess(): Promise<void> {
  const ctx = await loadAccessContext();
  if (!ctx) throw redirect({ to: "/login" });
  if (!can.manageFisios(ctx.roles, ctx.fisioterapeutaId)) {
    throw redirect({ to: "/app" });
  }
}
