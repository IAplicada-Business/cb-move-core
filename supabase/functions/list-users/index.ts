import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireAdminUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { admin } = await requireAdminUser(req);

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      admin.from("profiles").select("id, nome, email, created_at").order("nome"),
      admin.from("user_roles").select("user_id, role, created_at"),
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
      return {
        id: p.id,
        nome: p.nome,
        email: p.email,
        created_at: p.created_at,
        role: roleMap.get(p.id)?.role ?? null,
        paciente_id: pac?.id ?? null,
        paciente_nome: pac?.nome ?? null,
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
