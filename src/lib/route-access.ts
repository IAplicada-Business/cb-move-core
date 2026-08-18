import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import {
  getCachedAccessContext,
  syncAccessContext as storeAccessContext,
  type AccessContext,
} from "@/lib/access-context";
import { can } from "@/lib/permissions";
import type { AppRole } from "@/lib/types";

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

/**
 * Bloqueia fisio clínico e demais perfis sem permissão financeira.
 *
 * Usa o contexto em memória (o AuthProvider o mantém sincronizado a cada carga de
 * papéis) — sem isso, cada navegação para uma tela financeira faria duas consultas
 * ao Supabase dentro do `beforeLoad`, e o roteador trocaria a tela pelo pending.
 */
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
