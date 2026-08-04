import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireAdminUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreateBody = {
  email?: string;
  nome?: string;
  role?: string;
  paciente_id?: string | null;
  fisioterapeuta_id?: string | null;
};

const ALLOWED_ROLES = new Set(["admin", "membro", "cliente", "recepcao", "gestao", "fisio"]);

const DEFAULT_INITIAL_PASSWORD = Deno.env.get("DEFAULT_INITIAL_PASSWORD") ?? "CB2026";

async function findUserByEmail(
  admin: Awaited<ReturnType<typeof requireAdminUser>>["admin"],
  email: string,
) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function upsertRoleAndProfile(
  admin: Awaited<ReturnType<typeof requireAdminUser>>["admin"],
  userId: string,
  email: string,
  nome: string,
  role: string,
  pacienteId: string | null,
  fisioterapeutaId: string | null,
) {
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (roleErr) throw roleErr;

  let linkedFisioId = fisioterapeutaId;
  if (role === "fisio" && !linkedFisioId) {
    const { data: fisioByEmail } = await admin
      .from("fisioterapeutas")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    linkedFisioId = fisioByEmail?.id ?? null;
  }

  const profile: Record<string, unknown> = {
    id: userId,
    nome,
    email,
    fisioterapeuta_id: role === "fisio" ? linkedFisioId : null,
  };

  const { error: profErr } = await admin.from("profiles").upsert(profile, { onConflict: "id" });
  if (profErr) throw profErr;

  if (role === "cliente" && pacienteId) {
    await admin.from("pacientes").update({ user_id: userId }).eq("id", pacienteId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { admin } = await requireAdminUser(req);
    const body = (await req.json()) as CreateBody;

    const email = body.email?.trim().toLowerCase();
    const nome = body.nome?.trim();
    const role = body.role ?? "recepcao";
    const pacienteId = body.paciente_id?.trim() || null;
    const fisioterapeutaId = body.fisioterapeuta_id?.trim() || null;

    if (!email || !nome) {
      return new Response(JSON.stringify({ error: "E-mail e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_ROLES.has(role)) {
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

    if (role === "fisio" && !fisioterapeutaId) {
      const { data: fisioByEmail } = await admin
        .from("fisioterapeutas")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (!fisioByEmail?.id) {
        return new Response(
          JSON.stringify({ error: "Fisioterapeuta precisa estar vinculado ao cadastro de fisio" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const existing = await findUserByEmail(admin, email);
    let userId = existing?.id ?? null;
    const isNew = !userId;

    if (role === "cliente") {
      const { data: paciente, error: pacErr } = await admin
        .from("pacientes")
        .select("id, user_id")
        .eq("id", pacienteId)
        .maybeSingle();

      if (pacErr || !paciente) {
        return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (paciente.user_id && paciente.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Paciente já possui acesso ao portal" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_INITIAL_PASSWORD,
        email_confirm: true,
        user_metadata: {
          nome,
          role,
          must_reset_password: true,
          ...(pacienteId ? { paciente_id: pacienteId } : {}),
        },
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = data.user?.id ?? null;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Usuário criado sem ID" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await upsertRoleAndProfile(admin, userId, email, nome, role, pacienteId, fisioterapeutaId);

    if (isNew) {
      await admin.auth.admin.updateUserById(userId, {
        password: DEFAULT_INITIAL_PASSWORD,
        user_metadata: {
          nome,
          role,
          must_reset_password: true,
          ...(pacienteId ? { paciente_id: pacienteId } : {}),
        },
      });
    } else {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          nome,
          role,
          ...(pacienteId ? { paciente_id: pacienteId } : {}),
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        created: isNew,
        message: isNew
          ? `Usuário cadastrado. Senha inicial: ${DEFAULT_INITIAL_PASSWORD} — redefinir no 1º login.`
          : "Usuário atualizado. Senha atual mantida.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    console.error("create-user", err);
    return new Response(JSON.stringify({ error: "Erro interno ao cadastrar usuário" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
