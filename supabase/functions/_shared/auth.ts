import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type AdminAuthContext = {
  userId: string;
  admin: SupabaseClient;
};

const FINANCE_ROLES = new Set(["admin", "gestao", "recepcao", "membro"]);

export function resolveAnonKey(): string | undefined {
  const direct = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (direct) return direct;

  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!publishableKeys) return undefined;

  try {
    const parsed = JSON.parse(publishableKeys) as Record<string, string>;
    return parsed.anon ?? parsed.publishable ?? Object.values(parsed)[0];
  } catch {
    return undefined;
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function resolveUserFromRequest(req: Request, supabaseUrl: string, supabaseAnon: string) {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AuthError("Token ausente", 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) throw new AuthError("Não autenticado", 401);
  return user;
}

export async function requireAdminUser(req: Request): Promise<AdminAuthContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = resolveAnonKey();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    throw new AuthError("Configuração Supabase incompleta", 500);
  }

  const user = await resolveUserFromRequest(req, supabaseUrl, supabaseAnon);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesErr) throw new AuthError("Erro ao verificar permissões", 500);

  const isAdmin = roles?.some((r) => r.role === "admin");
  if (!isAdmin) throw new AuthError("Apenas administradores", 403);

  return { userId: user.id, admin };
}

export type FinanceAuthContext = {
  userId: string;
  admin: SupabaseClient;
};

export async function requireFinanceUser(req: Request): Promise<FinanceAuthContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = resolveAnonKey();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    throw new AuthError("Configuração Supabase incompleta", 500);
  }

  const user = await resolveUserFromRequest(req, supabaseUrl, supabaseAnon);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesErr) throw new AuthError("Erro ao verificar permissões", 500);

  const allowed = roles?.some((r) => FINANCE_ROLES.has(r.role));
  if (!allowed) throw new AuthError("Sem permissão financeira", 403);

  return { userId: user.id, admin };
}

export function authErrorResponse(err: unknown, corsHeaders: Record<string, string>) {
  if (err instanceof AuthError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}
