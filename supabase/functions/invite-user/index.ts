import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireAdminUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InviteBody = {
  email?: string;
  nome?: string;
  role?: "admin" | "membro" | "cliente";
  paciente_id?: string | null;
};

const STAFF_ROLES = new Set(["admin", "membro", "cliente"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { admin } = await requireAdminUser(req);
    const body = (await req.json()) as InviteBody;

    const email = body.email?.trim().toLowerCase();
    const nome = body.nome?.trim();
    const role = body.role ?? "membro";
    const pacienteId = body.paciente_id?.trim() || null;

    if (!email || !nome) {
      return new Response(JSON.stringify({ error: "E-mail e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!STAFF_ROLES.has(role)) {
      return new Response(JSON.stringify({ error: "Perfil inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "cliente" && !pacienteId) {
      return new Response(
        JSON.stringify({ error: "Cliente precisa estar vinculado a um paciente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (role === "cliente") {
      const { data: paciente, error: pacErr } = await admin
        .from("pacientes")
        .select("id, user_id, nome")
        .eq("id", pacienteId)
        .maybeSingle();

      if (pacErr || !paciente) {
        return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (paciente.user_id) {
        return new Response(JSON.stringify({ error: "Paciente já possui acesso ao portal" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const siteUrl =
      Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:8080";
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/redefinir-senha`;

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        nome,
        role,
        invited: true,
        ...(pacienteId ? { paciente_id: pacienteId } : {}),
      },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: data.user?.id ?? null,
        message: "Convite enviado por e-mail. A pessoa definirá a senha no primeiro acesso.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    console.error("invite-user", err);
    return new Response(JSON.stringify({ error: "Erro interno ao convidar usuário" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
