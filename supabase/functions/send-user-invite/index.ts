import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireAdminUser, resolveAnonKey } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SITE_URL = "https://cb-move-harmony.lovable.app";

type InviteBody = {
  email?: string;
  user_id?: string;
};

async function resolveEmail(
  admin: Awaited<ReturnType<typeof requireAdminUser>>["admin"],
  body: InviteBody,
): Promise<string | null> {
  if (body.email?.trim()) return body.email.trim().toLowerCase();

  const userId = body.user_id?.trim();
  if (!userId) return null;

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email.toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { admin } = await requireAdminUser(req);
    const body = (await req.json()) as InviteBody;
    const email = await resolveEmail(admin, body);

    if (!email) {
      return new Response(JSON.stringify({ error: "Informe e-mail ou user_id válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? DEFAULT_SITE_URL;
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/redefinir-senha`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = resolveAnonKey();
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: "Configuração Supabase incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, redirect_to: redirectTo }),
    });

    if (!recoverRes.ok) {
      const errText = await recoverRes.text();
      return new Response(JSON.stringify({ error: errText || "Falha ao enviar convite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: `Convite enviado para ${email}. A pessoa definirá a senha no primeiro acesso.`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    console.error("send-user-invite", err);
    return new Response(JSON.stringify({ error: "Erro interno ao enviar convite" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
