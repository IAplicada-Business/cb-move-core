import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const FINANCE_ROLES = new Set(["admin", "gestao", "recepcao"]);

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type FinanceAuthContext = {
  userId: string;
  admin: SupabaseClient;
};

export async function requireFinanceUser(req: Request): Promise<FinanceAuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Token ausente", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    throw new AuthError("Configuração Supabase incompleta", 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new AuthError("Não autenticado", 401);

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
