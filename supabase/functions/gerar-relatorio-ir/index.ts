import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthError,
  authErrorResponse,
  requireFinanceUser,
  resolveAnonKey,
} from "../_shared/auth.ts";
import { bytesToBase64, gerarPdfRelatorioIr } from "../_shared/pdf-ir.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requireFinanceOrOwnPaciente(
  req: Request,
  pacienteId: string,
): Promise<{ admin: ReturnType<typeof createClient> }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = resolveAnonKey();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    throw new AuthError("Configuração Supabase incompleta", 500);
  }

  try {
    return await requireFinanceUser(req);
  } catch (err) {
    if (!(err instanceof AuthError) || err.status !== 403) throw err;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new AuthError("Token ausente", 401);
  const token = authHeader.slice(7).trim();

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);
  if (error || !user) throw new AuthError("Não autenticado", 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: pac, error: pacErr } = await admin
    .from("pacientes")
    .select("id")
    .eq("id", pacienteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (pacErr) throw new AuthError("Erro ao verificar paciente", 500);
  if (!pac) throw new AuthError("Sem permissão para este relatório", 403);

  return { admin };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const paciente_id = body?.paciente_id as string | undefined;
    const ano = Number(body?.ano);

    if (!paciente_id || !Number.isFinite(ano) || ano < 2000 || ano > 2100) {
      throw new AuthError("paciente_id e ano obrigatórios", 400);
    }

    const { admin } = await requireFinanceOrOwnPaciente(req, paciente_id);

    const { data: nfs, error } = await admin
      .from("notas_fiscais")
      .select("numero, emissao, destinatario_nome, status, valor, pacientes(nome, cpf)")
      .eq("paciente_id", paciente_id)
      .eq("status", "emitida")
      .gte("emissao", `${ano}-01-01`)
      .lte("emissao", `${ano}-12-31`)
      .order("emissao");

    if (error) throw error;

    const paciente = (
      nfs?.[0] as { pacientes?: { nome?: string; cpf?: string | null } } | undefined
    )?.pacientes;

    let pacienteNome = paciente?.nome ?? "";
    let pacienteCpf = paciente?.cpf ?? null;
    if (!pacienteNome) {
      const { data: pacRow } = await admin
        .from("pacientes")
        .select("nome, cpf")
        .eq("id", paciente_id)
        .maybeSingle();
      pacienteNome = pacRow?.nome ?? "Paciente";
      pacienteCpf = pacRow?.cpf ?? null;
    }

    const notas = (nfs ?? []).map((n) => ({
      numero: (n.numero as string | null) ?? null,
      emissao: (n.emissao as string | null) ?? null,
      destinatario_nome: (n.destinatario_nome as string | null) ?? null,
      status: (n.status as string | null) ?? null,
      valor: Number(n.valor) || 0,
    }));
    const total = notas.reduce((s, n) => s + n.valor, 0);

    const pdfBytes = await gerarPdfRelatorioIr({
      pacienteNome,
      pacienteCpf,
      ano,
      notas,
      total,
    });

    const filename = `ir-${ano}-${
      pacienteNome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
        .slice(0, 40) || "paciente"
    }.pdf`;

    return new Response(
      JSON.stringify({
        paciente_nome: pacienteNome,
        paciente_cpf: pacienteCpf,
        ano,
        total,
        qtd_notas: notas.length,
        filename,
        pdf_base64: bytesToBase64(pdfBytes),
        content_type: "application/pdf",
        rodape: `Documento gerado pela CB MOVE Neuroscience em ${new Date().toLocaleDateString("pt-BR")} — para fins de declaração anual de IR`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const authRes = authErrorResponse(err, corsHeaders);
    if (authRes) return authRes;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
