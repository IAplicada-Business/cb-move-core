import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireAdminUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreateBody = {
  email?: string;
  nome?: string;
  /** @deprecated use perfil */
  role?: "admin" | "membro" | "cliente";
  perfil?: "admin" | "fisio" | "cliente" | "operacional";
  paciente_id?: string | null;
  fisio?: {
    registro_profissional?: string | null;
    ativo?: boolean;
  };
};

type CadastroPerfil = NonNullable<CreateBody["perfil"]>;

const VALID_PERFIS = new Set<CadastroPerfil>(["admin", "fisio", "cliente", "operacional"]);

function resolvePerfil(body: CreateBody): CadastroPerfil {
  if (body.perfil && VALID_PERFIS.has(body.perfil)) return body.perfil;
  const legacy = body.role ?? null;
  if (legacy === "admin") return "admin";
  if (legacy === "cliente") return "cliente";
  if (legacy === "membro") return "operacional";
  throw new CreateUserError(
    "Perfil inválido. Use administrador, equipe, fisioterapeuta ou cliente.",
  );
}

function perfilToRole(perfil: CadastroPerfil): string {
  switch (perfil) {
    case "admin":
      return "admin";
    case "cliente":
      return "cliente";
    case "fisio":
    case "operacional":
      return "membro";
  }
}

const DEFAULT_INITIAL_PASSWORD = Deno.env.get("DEFAULT_INITIAL_PASSWORD") ?? "CB2026";

class CreateUserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CreateUserError";
    this.status = status;
  }
}

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

async function ensureFisioRecord(
  admin: Awaited<ReturnType<typeof requireAdminUser>>["admin"],
  email: string,
  nome: string,
  fisioFields?: CreateBody["fisio"],
): Promise<string> {
  const registro = fisioFields?.registro_profissional?.trim() || null;
  const ativo = fisioFields?.ativo ?? true;

  const { data: existing, error: findErr } = await admin
    .from("fisioterapeutas")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing?.id) {
    const { error: updErr } = await admin
      .from("fisioterapeutas")
      .update({ nome, email, registro_profissional: registro, ativo })
      .eq("id", existing.id);
    if (updErr) throw updErr;
    return existing.id;
  }

  const { data: inserted, error: insErr } = await admin
    .from("fisioterapeutas")
    .insert({ nome, email, registro_profissional: registro, ativo })
    .select("id")
    .single();
  if (insErr) throw insErr;
  if (!inserted?.id) {
    throw new CreateUserError("Não foi possível criar o registro clínico do fisioterapeuta.");
  }
  return inserted.id;
}

async function syncPacienteLink(
  admin: Awaited<ReturnType<typeof requireAdminUser>>["admin"],
  userId: string,
  perfil: CadastroPerfil,
  pacienteId: string | null,
) {
  await admin.from("pacientes").update({ user_id: null }).eq("user_id", userId);
  if (perfil === "cliente" && pacienteId) {
    const { error } = await admin
      .from("pacientes")
      .update({ user_id: userId })
      .eq("id", pacienteId);
    if (error) throw error;
  }
}

async function upsertRoleAndProfile(
  admin: Awaited<ReturnType<typeof requireAdminUser>>["admin"],
  userId: string,
  email: string,
  nome: string,
  perfil: CadastroPerfil,
  pacienteId: string | null,
  fisioId: string | null,
) {
  const role = perfilToRole(perfil);
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (roleErr) throw roleErr;

  const profile: Record<string, unknown> = { id: userId, nome, email };

  if (perfil === "fisio") {
    if (!fisioId) {
      throw new CreateUserError("Registro clínico do fisioterapeuta não encontrado.");
    }
    profile.fisioterapeuta_id = fisioId;
  } else {
    profile.fisioterapeuta_id = null;
  }

  const { error: profErr } = await admin.from("profiles").upsert(profile, { onConflict: "id" });
  if (profErr) throw profErr;

  await syncPacienteLink(admin, userId, perfil, pacienteId);
}

function buildUserMetadata(
  existingMeta: Record<string, unknown> | undefined,
  nome: string,
  role: string,
  perfil: CadastroPerfil,
  pacienteId: string | null,
  isNewUser: boolean,
): Record<string, unknown> {
  const userMetadata: Record<string, unknown> = {
    ...(existingMeta ?? {}),
    nome,
    role,
  };

  if (perfil === "cliente" && pacienteId) {
    userMetadata.paciente_id = pacienteId;
  } else {
    userMetadata.paciente_id = null;
  }

  if (isNewUser) {
    userMetadata.must_reset_password = true;
  }

  return userMetadata;
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
    const perfil = resolvePerfil(body);
    const role = perfilToRole(perfil);
    const pacienteId = body.paciente_id?.trim() || null;

    if (!email || !nome) {
      return new Response(JSON.stringify({ error: "E-mail e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (perfil === "cliente" && !pacienteId) {
      return new Response(
        JSON.stringify({ error: "Cliente precisa estar vinculado a um paciente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const existing = await findUserByEmail(admin, email);
    const existingUserId = existing?.id ?? null;

    if (perfil === "cliente") {
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

      if (paciente.user_id && paciente.user_id !== existingUserId) {
        return new Response(JSON.stringify({ error: "Paciente já possui acesso ao portal" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let fisioId: string | null = null;
    if (perfil === "fisio") {
      fisioId = await ensureFisioRecord(admin, email, nome, body.fisio);
    }

    let userId = existingUserId;

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

    await upsertRoleAndProfile(admin, userId, email, nome, perfil, pacienteId, fisioId);

    const userMetadata = buildUserMetadata(
      existing?.user_metadata as Record<string, unknown> | undefined,
      nome,
      role,
      perfil,
      pacienteId,
      !existing,
    );

    if (existing) {
      await admin.auth.admin.updateUserById(userId, { user_metadata: userMetadata });
    } else {
      await admin.auth.admin.updateUserById(userId, {
        password: DEFAULT_INITIAL_PASSWORD,
        user_metadata: userMetadata,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        created: !existing,
        message: existing
          ? "Usuário atualizado."
          : `Usuário cadastrado. Senha inicial: ${DEFAULT_INITIAL_PASSWORD} — redefinir no 1º login.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    if (err instanceof CreateUserError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("create-user", err);
    return new Response(JSON.stringify({ error: "Erro interno ao cadastrar usuário" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
