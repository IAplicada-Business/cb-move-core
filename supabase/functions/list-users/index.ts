import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireAdminUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AuthMeta = {
  must_reset_password: boolean;
  last_sign_in_at: string | null;
};

async function buildAuthMetaMaps(
  admin: Awaited<ReturnType<typeof requireAdminUser>>["admin"],
): Promise<{ byId: Map<string, AuthMeta>; byEmail: Map<string, AuthMeta> }> {
  const byId = new Map<string, AuthMeta>();
  const byEmail = new Map<string, AuthMeta>();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      const meta: AuthMeta = {
        must_reset_password: u.user_metadata?.must_reset_password === true,
        last_sign_in_at: u.last_sign_in_at ?? null,
      };
      byId.set(u.id, meta);
      if (u.email) byEmail.set(u.email.toLowerCase(), meta);
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return { byId, byEmail };
}

function resolveAuthMeta(
  profileId: string,
  emailKey: string,
  byId: Map<string, AuthMeta>,
  byEmail: Map<string, AuthMeta>,
): AuthMeta | undefined {
  return byId.get(profileId) ?? (emailKey ? byEmail.get(emailKey) : undefined);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { admin } = await requireAdminUser(req);

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, authMaps] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, nome, email, created_at, fisioterapeuta_id")
          .order("nome"),
        admin.from("user_roles").select("user_id, role, created_at"),
        buildAuthMetaMaps(admin),
      ]);

    if (pErr) throw pErr;
    if (rErr) throw rErr;

    const { data: pacientes, error: pacErr } = await admin
      .from("pacientes")
      .select("id, nome, user_id")
      .not("user_id", "is", null);
    if (pacErr) throw pacErr;

    const roleMap = new Map<string, { role: string; created_at: string }>();
    for (const row of roles ?? []) {
      const prev = roleMap.get(row.user_id);
      if (!prev || row.created_at < prev.created_at) {
        roleMap.set(row.user_id, { role: row.role, created_at: row.created_at });
      }
    }

    const pacienteMap = new Map<string, { id: string; nome: string }>();
    for (const pac of pacientes ?? []) {
      if (pac.user_id) pacienteMap.set(pac.user_id, { id: pac.id, nome: pac.nome });
    }

    const users = (profiles ?? []).map((p) => {
      const pac = pacienteMap.get(p.id);
      const emailKey = p.email?.toLowerCase() ?? "";
      const authMeta = resolveAuthMeta(p.id, emailKey, authMaps.byId, authMaps.byEmail);
      return {
        id: p.id,
        nome: p.nome,
        email: p.email,
        created_at: p.created_at,
        role: roleMap.get(p.id)?.role ?? null,
        paciente_id: pac?.id ?? null,
        paciente_nome: pac?.nome ?? null,
        fisioterapeuta_id: p.fisioterapeuta_id ?? null,
        must_reset_password: authMeta?.must_reset_password ?? false,
        last_sign_in_at: authMeta?.last_sign_in_at ?? null,
        auth_meta_loaded: !!authMeta,
      };
    });

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    console.error("list-users", err);
    return new Response(JSON.stringify({ error: "Erro ao listar usuários" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
