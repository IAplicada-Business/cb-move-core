import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireFinanceUserOrInternal } from "../_shared/auth.ts";
import {
  focusRefFromNfId,
  getFocusNfsen,
  loadFocusNfeConfig,
  submitFocusNfsen,
  formatDiasAtendidos,
  tipoSessaoDeTexto,
  type NfForFocus,
  type TomadorForFocus,
} from "../_shared/focus-nfe.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
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
  valor_sessao: number | null;
  frequencia_atendimento: string | null;
  endereco?: string | null;
  numero_endereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
  codigo_municipio_ibge?: number | null;
  fisioterapeutas: FisioRow | FisioRow[] | null;
  convenios: ConvenioTomadorRow | ConvenioTomadorRow[] | null;
};

const SIGLAS_REALIZADAS = ["P", "RC"];
const MULT_POR_TIPO: Record<string, number> = { simples: 1, duplo: 2, triplo: 3, quadruplo: 4 };

/** Precedência: cobrança da competência → cadastro do paciente. */
function resolverFrequenciaCompetencia(
  cobranca: string | null | undefined,
  paciente: string | null | undefined,
): string | null {
  const trimmed = cobranca?.trim() || paciente?.trim();
  return trimmed || null;
}

async function fetchFrequenciaCompetencia(
  admin: SupabaseClient,
  pacienteId: string | null,
  mes: number | null,
  ano: number | null,
  pacienteFrequencia: string | null | undefined,
): Promise<string | null> {
  if (!pacienteId || !mes || !ano) {
    return resolverFrequenciaCompetencia(null, pacienteFrequencia);
  }
  const { data } = await admin
    .from("cobrancas")
    .select("frequencia_atendimento")
    .eq("paciente_id", pacienteId)
    .eq("competencia_mes", mes)
    .eq("competencia_ano", ano)
    .maybeSingle();
  const cobFreq = (data as { frequencia_atendimento?: string | null } | null)
    ?.frequencia_atendimento;
  return resolverFrequenciaCompetencia(cobFreq, pacienteFrequencia);
}

/** Dias atendidos (sigla P/RC) e total de sessões da competência, a partir de `sessoes`. */
async function computeSessoesCompetencia(
  admin: SupabaseClient,
  pacienteId: string | null,
  mes: number | null,
  ano: number | null,
  multiplicador: number,
): Promise<{ diasTexto: string | null; total: number | null }> {
  if (!pacienteId || !mes || !ano) return { diasTexto: null, total: null };
  const mm = String(mes).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const { data, error } = await admin
    .from("sessoes")
    .select("data, sigla")
    .eq("paciente_id", pacienteId)
    .gte("data", `${ano}-${mm}-01`)
    .lte("data", `${ano}-${mm}-${String(ultimoDia).padStart(2, "0")}`)
    .in("sigla", SIGLAS_REALIZADAS);
  if (error || !data) return { diasTexto: null, total: null };

  const dias = new Set<number>();
  for (const s of data as { data: string; sigla: string | null }[]) {
    dias.add(Number(String(s.data).slice(8, 10)));
  }
  if (dias.size === 0) return { diasTexto: null, total: null };
  // Limitação: sessoes tem 1 linha/dia, então "duplo" não é distinguível por dia.
  // Total = dias × multiplicador do plano (exato p/ simples/duplo uniforme; aprox. p/ misto).
  return { diasTexto: formatDiasAtendidos([...dias]), total: dias.size * multiplicador };
}

function tomadorFromConvenio(
  convenio: ConvenioTomadorRow | null | undefined,
): TomadorForFocus | undefined {
  if (!convenio) return undefined;
  return {
    email: convenio.email_nf,
    endereco: convenio.endereco ?? null,
    numero: convenio.numero ?? null,
    complemento: convenio.complemento ?? null,
    bairro: convenio.bairro ?? null,
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

  const convenio = Array.isArray(paciente.convenios) ? paciente.convenios[0] : paciente.convenios;

  if (tipo === "particular") {
    return mergeTomador(documento, undefined, {
      email: paciente.email,
      telefone: paciente.telefone,
      endereco: paciente.endereco ?? null,
      numero: paciente.numero_endereco ?? null,
      complemento: paciente.complemento ?? null,
      bairro: paciente.bairro ?? null,
      cep: paciente.cep ?? null,
      cidade: paciente.cidade ?? null,
      uf: paciente.uf ?? null,
      codigo_municipio_ibge: paciente.codigo_municipio_ibge ?? null,
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
  } else if (
    nome &&
    !nome.toUpperCase().startsWith("DRA") &&
    !nome.toUpperCase().startsWith("DR ")
  ) {
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
    const { admin } = await requireFinanceUserOrInternal(req);
    const authHeader = req.headers.get("Authorization");
    const body = await req.json();
    const { nf_id, modo, numero, pdf_url } = body;

    if (!nf_id) throw new Error("nf_id obrigatório");

    const { data: nf, error } = await admin
      .from("notas_fiscais")
      .select(
        `
        id, tipo, status, valor, paciente_id,
        competencia_mes, competencia_ano,
        destinatario_nome, destinatario_documento,
        corpo_paciente_nome, corpo_paciente_cpf,
        corpo_numero_processo, corpo_total_sessoes,
        corpo_dias_atendidos,
        pacientes (
          email, telefone, valor_sessao, frequencia_atendimento,
          endereco, numero_endereco, complemento, bairro, cep, cidade, uf, codigo_municipio_ibge,
          fisioterapeutas!pacientes_fisioterapeuta_id_fkey ( nome, registro_profissional ),
          convenios (
            cnpj, razao_social, email_nf,
            endereco, numero, complemento, bairro, cep, cidade, uf, codigo_municipio_ibge
          )
        )
      `,
      )
      .eq("id", nf_id)
      .single();
    if (error) throw new Error(error.message ?? "Erro ao carregar NF");
    if (!nf) throw new Error("NF não encontrada");

    const paciente = (nf as { pacientes?: PacienteTomadorRow | null }).pacientes ?? null;
    const fisio = resolveFisio(paciente);

    // Descrição conforme texto-padrão: dias/sessões vêm de `sessoes` (P/RC) quando não
    // gravados na NF. Multiplicidade (simples/duplo) vem da cobrança da competência ou paciente.
    const frequenciaLabel = await fetchFrequenciaCompetencia(
      admin,
      nf.paciente_id,
      nf.competencia_mes,
      nf.competencia_ano,
      paciente?.frequencia_atendimento,
    );
    const tipoSessao = tipoSessaoDeTexto(frequenciaLabel);
    const multiplicador = MULT_POR_TIPO[tipoSessao] ?? 1;
    const diasGravados = (
      (nf as { corpo_dias_atendidos?: string | null }).corpo_dias_atendidos ?? ""
    ).trim();
    const computado = diasGravados
      ? { diasTexto: diasGravados, total: nf.corpo_total_sessoes }
      : await computeSessoesCompetencia(
          admin,
          nf.paciente_id,
          nf.competencia_mes,
          nf.competencia_ano,
          multiplicador,
        );

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
      corpo_total_sessoes: nf.corpo_total_sessoes ?? computado.total,
      corpo_dias_atendidos: computado.diasTexto,
      tipo_sessao: tipoSessao,
      valor_sessao: paciente?.valor_sessao ?? null,
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
