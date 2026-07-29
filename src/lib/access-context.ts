import type { AppRole } from "@/lib/types";

export type AccessContext = {
  roles: AppRole[];
  fisioterapeutaId: string | null;
};

let cached: AccessContext | null = null;

/** Sincronizado pelo AuthProvider — evita round-trip ao Supabase em cada beforeLoad. */
export function syncAccessContext(ctx: AccessContext | null) {
  cached = ctx;
}

export function getCachedAccessContext(): AccessContext | null {
  return cached;
}

/** Força beforeLoad a buscar papéis no Supabase na próxima navegação. */
export function invalidateAccessContext() {
  cached = null;
}
