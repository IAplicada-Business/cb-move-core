import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUser } from "../_shared/auth.ts";
import {
  focusRefFromNfId,
  getFocusNfsen,
  loadFocusNfeConfig,
  submitFocusNfsen,
  type NfForFocus,
  type TomadorForFocus,
} from "../_shared/focus-nfe.ts";
import { mergeTomador } from "../_shared/focus-nfe-tomador-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function triggerSendNfEmail(
  nfId: string,
  tipo: string,
  authHeader: string | null,
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return { ok: false, error: "SUPABASE_URL ausente" };

  const eventId = `nf-emit-${nfId}`;
  const res = await fetch(`${supabaseUrl}/functions/v1/send-nf-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ nf_id: nfId, tipo, event_id: eventId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error ?? `send-nf-email retornou ${res.status}` };
  }
  return { ok: true, queued: data.queued };
}

type ConvenioTomadorRow = {
  cnpj: string | null;
  razao_social: string | null;
  email_nf: string | null;
  endereco?: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
  codigo_municipio_ibge?: number | null;
};

type FisioRow = {
  nome: string | null;
  registro_profissional: string | null;
};

type PacienteTomadorRow = {
  email: string | null;
  telefone: string | null;
  fisioterapeutas: FisioRow | FisioRow[] | null;
  convenios: ConvenioTomadorRow | ConvenioTomadorRow[] | null;
};

function tomadorFromConvenio(convenio: ConvenioTomadorRow | null | undefined): TomadorForFocus | undefined {
  if (!convenio) return undefined;
  return {
    email: convenio.email_nf,
    endereco: convenio.endereco ?? null,
    cep: convenio.cep ?? null,
    cidade: convenio.cidade ?? null,
    uf: convenio.uf ?? null,
    codigo_municipio_ibge: convenio.codigo_municipio_ibge ?? null,
  };
}

function resolveTomador(
  tipo: string | null,
  documento: string | null,
  paciente: PacienteTomadorRow | null,
): TomadorForFocus | undefined {
  if (!paciente) return undefined;

  const convenio = Array.isArray(paciente.convenios)
    ? paciente.convenios[0]
    : paciente.convenios;

  if (tipo === "particular") {
    return mergeTomador(documento, undefined, {
      email: paciente.email,
      telefone: paciente.telefone,
    });
  }

  return mergeTomador(documento, tomadorFromConvenio(convenio));
}

function resolveFisio(paciente: PacienteTomadorRow | null): {
  nome: string | null;
  crefito: string | null;
} {
  const fisio = Array.isArray(paciente?.fisioterapeutas)
    ? paciente?.fisioterapeutas[0]
    : paciente?.fisioterapeutas;
  if (!fisio) return { nome: null, crefito: null };
  const nome = (fisio.nome ?? "").trim();
  // DANFSe usa "DRA. CHARLENE BRITO" — remove sobrenome extra quando padrao CB MOVE
  let display = nome;
  if (nome.toUpperCase().includes("CHARLENE BRITO")) {
    display = "DRA. CHARLENE BRITO";
  } else if (nome && !nome.toUpperCase().startsWith("DRA") && !nome.toUpperCase().startsWith("DR ")) {
    display = `DRA. ${nome}`;
  }
  return {
    nome: display || null,
    crefito: fisio.registro_profissional ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin } = await requireFinanceUser(req);
    const authHeader = req.headers.get("Authorization");
    const body = await req.json();
    const { nf_id, modo, numero, pdf_url } = body;

    if (!nf_id) throw new Error("nf_id obrigatório");

    const { data: nf, error } = await admin
      .from("notas_fiscais")
      .select(`
        id, tipo, status, valor, paciente_id,
        competencia_mes, competencia_ano,
        destinatario_nome, destinatario_documento,
        corpo_paciente_nome, corpo_paciente_cpf,
        corpo_numero_processo, corpo_total_sessoes,
        corpo_dias_atendidos,
        pacientes (
          email, telefone,
          fisioterapeutas ( nome, registro_profissional ),
          convenios (
            cnpj, razao_social, email_nf,
            endereco, cep, cidade, uf, codigo_municipio_ibge
          )
        )
      `)
      .eq("id", nf_id)
      .single();
    if (error || !nf) throw new Error("NF não encontrada");

    const paciente = (nf as { pacientes?: PacienteTomadorRow | null }).pacientes ?? null;
    const fisio = resolveFisio(paciente);
    const nfForFocus: NfForFocus = {
      id: nf.id,
      tipo: nf.tipo,
      valor: nf.valor,
      competencia_mes: nf.competencia_mes,
      competencia_ano: nf.competencia_ano,
      destinatario_nome: nf.destinatario_nome,
      destinatario_documento: nf.destinatario_documento,
      corpo_paciente_nome: nf.corpo_paciente_nome,
      corpo_paciente_cpf: nf.corpo_paciente_cpf,
      corpo_numero_processo: nf.corpo_numero_processo,
      corpo_total_sessoes: nf.corpo_total_sessoes,
      corpo_dias_atendidos: (nf as { corpo_dias_atendidos?: string | null }).corpo_dias_atendidos ?? null,
      fisio_nome: fisio.nome,
      fisio_crefito: fisio.crefito,
      tomador: resolveTomador(nf.tipo, nf.destinatario_documento, paciente),
    };

    const mode = modo ?? "automatico";

    if (mode === "manual") {
      if (!numero || !pdf_url) {
        throw new Error("Modo manual requer numero e pdf_url");
      }

      const { error: updErr } = await admin
        .from("notas_fiscais")
        .update({
          numero,
          pdf_url,
          status: "emitida",
          emissao: new Date().toISOString().split("T")[0],
          fiscal_provider: "manual",
        })
        .eq("id", nf_id);
      if (updErr) throw updErr;

      const emailResult = await triggerSendNfEmail(nf_id, nf.tipo, authHeader);

      return new Response(
        JSON.stringify({
          ok: true,
          nf_id,
          status: "emitida",
          email: emailResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const focusConfig = await loadFocusNfeConfig(admin);
    if (!focusConfig) {
      return new Response(
        JSON.stringify({
          error:
            "Focus NFe não configurado. Defina FOCUSNFE_TOKEN e FOCUSNFE_CNPJ_PRESTADOR em integracao_config.",
          nf_id,
          adapter: "focus_nfe",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (nf.status === "emitida") {
      throw new Error("NF já emitida");
    }

    if (nf.status === "processando") {
      const ref = focusRefFromNfId(nf_id);
      const current = await getFocusNfsen(focusConfig, ref);
      return new Response(
        JSON.stringify({
          ok: true,
          nf_id,
          status: "processando",
          fiscal_provider: "focus_nfe",
          focus_status: current.status,
          message: "NF já enviada à Focus — aguardando webhook ou consulta",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ref = focusRefFromNfId(nf_id);
    let result;

    try {
      result = await submitFocusNfsen(focusConfig, ref, nfForFocus);
    } catch (focusErr) {
      await admin
        .from("notas_fiscais")
        .update({ status: "erro", fiscal_provider: "focus_nfe" })
        .eq("id", nf_id);

      throw focusErr;
    }

    const { error: updErr } = await admin
      .from("notas_fiscais")
      .update({
        status: "processando",
        fiscal_provider: "focus_nfe",
      })
      .eq("id", nf_id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        ok: true,
        nf_id,
        status: "processando",
        fiscal_provider: "focus_nfe",
        focus_status: result.status,
        focus_ref: ref,
        message: "DPS enviado à Focus — autorização via webhook",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
