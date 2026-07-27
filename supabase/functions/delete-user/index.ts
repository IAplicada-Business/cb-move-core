import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireAdminUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeleteBody = {
  user_id?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { admin, userId: requesterId } = await requireAdminUser(req);
    const body = (await req.json()) as DeleteBody;
    const targetId = body.user_id?.trim();

    if (!targetId) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetId === requesterId) {
      return new Response(JSON.stringify({ error: "Você não pode excluir seu próprio usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetRoles, error: targetRolesErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetId);
    if (targetRolesErr) throw targetRolesErr;

    const isTargetAdmin = (targetRoles ?? []).some((r) => r.role === "admin");
    if (isTargetAdmin) {
      const { count, error: countErr } = await admin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if (countErr) throw countErr;

      if ((count ?? 0) <= 1) {
        return new Response(
          JSON.stringify({ error: "Não é possível excluir o último administrador" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    await admin.from("pacientes").update({ user_id: null }).eq("user_id", targetId);
    await admin.from("user_roles").delete().eq("user_id", targetId);
    await admin.from("profiles").delete().eq("id", targetId);

    const { error: deleteErr } = await admin.auth.admin.deleteUser(targetId);
    if (deleteErr) throw deleteErr;

    return new Response(JSON.stringify({ ok: true, message: "Usuário excluído com sucesso." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    console.error("delete-user", err);
    return new Response(JSON.stringify({ error: "Erro interno ao excluir usuário" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
