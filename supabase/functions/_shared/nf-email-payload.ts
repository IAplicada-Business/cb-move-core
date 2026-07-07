import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEMPLATE_BY_TIPO: Record<string, string> = {
  particular: "RQ.GPS.08.001",
  convenio: "RQ.GPS.08.002",
  judicial: "RQ.GPS.08.003",
  puc: "RQ.GPS.08.002",
};

type NfRow = {
  id: string;
  numero: string | null;
  valor: number | string;
  tipo: string | null;
  status: string;
  emissao: string | null;
  pdf_url: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  destinatario_nome: string | null;
  destinatario_documento: string | null;
  corpo_paciente_nome: string | null;
  corpo_paciente_cpf: string | null;
  corpo_numero_processo: string | null;
  corpo_total_sessoes: number | null;
  cobranca_id: string | null;
  paciente_id: string | null;
  pacientes: {
    nome: string;
    email: string | null;
    cpf: string | null;
    numero_processo: string | null;
    advogado_email: string | null;
    convenio_id: string | null;
    convenios: { nome: string; email_nf: string | null; razao_social: string | null } | null;
  } | null;
};

export type NfEmailPayload = {
  event: "nf_emitida";
  event_id: string;
  nf_id: string;
  tipo: string;
  reenvio: boolean;
  numero: string | null;
  valor: number;
  emissao: string | null;
  pdf_url: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  competencia_label: string | null;
  destinatario_nome: string | null;
  destinatario_documento: string | null;
  corpo_paciente_nome: string | null;
  corpo_paciente_cpf: string | null;
  corpo_numero_processo: string | null;
  corpo_total_sessoes: number | null;
  paciente_id: string | null;
  paciente_nome: string | null;
  cobranca_id: string | null;
  to_email: string | null;
  cc_emails: string[];
  template_codigo: string;
  assunto_sugerido: string;
};

function competenciaLabel(mes: number | null, ano: number | null): string | null {
  if (!mes || !ano) return null;
  const names = [
    "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${names[mes]}/${ano}`;
}

function resolveEmails(nf: NfRow): { to: string | null; cc: string[] } {
  const tipo = nf.tipo ?? "particular";
  const paciente = nf.pacientes;
  const convenio = paciente?.convenios;

  if (tipo === "particular") {
    return { to: paciente?.email ?? null, cc: [] };
  }

  if (tipo === "convenio" || tipo === "puc") {
    return { to: convenio?.email_nf ?? null, cc: [] };
  }

  if (tipo === "judicial") {
    const cc = paciente?.advogado_email ? [paciente.advogado_email] : [];
    return { to: convenio?.email_nf ?? paciente?.email ?? null, cc };
  }

  return { to: paciente?.email ?? null, cc: [] };
}

function buildAssunto(nf: NfRow): string {
  const comp = competenciaLabel(nf.competencia_mes, nf.competencia_ano) ?? "";
  const paciente = nf.corpo_paciente_nome ?? nf.pacientes?.nome ?? "Paciente";
  const numero = nf.numero ? ` NF ${nf.numero}` : "";

  if (nf.tipo === "judicial") {
    const proc = nf.corpo_numero_processo ?? nf.pacientes?.numero_processo ?? "";
    return `CB MOVE${numero} — ${paciente}${proc ? ` — Proc. ${proc}` : ""} — ${comp}`.trim();
  }

  if (nf.tipo === "convenio") {
    return `CB MOVE${numero} — ${nf.destinatario_nome ?? "Convênio"} — ${comp}`.trim();
  }

  return `CB MOVE${numero} — ${paciente} — ${comp}`.trim();
}

export async function loadNfForEmail(admin: SupabaseClient, nfId: string): Promise<NfRow> {
  const { data, error } = await admin
    .from("notas_fiscais")
    .select(`
      id, numero, valor, tipo, status, emissao, pdf_url,
      competencia_mes, competencia_ano,
      destinatario_nome, destinatario_documento,
      corpo_paciente_nome, corpo_paciente_cpf,
      corpo_numero_processo, corpo_total_sessoes,
      cobranca_id, paciente_id,
      pacientes (
        nome, email, cpf, numero_processo, advogado_email, convenio_id,
        convenios ( nome, email_nf, razao_social )
      )
    `)
    .eq("id", nfId)
    .single();

  if (error || !data) throw new Error("NF não encontrada");
  return data as NfRow;
}

export function buildNfEmailPayload(
  nf: NfRow,
  eventId: string,
  reenvio = false,
): NfEmailPayload {
  const tipo = nf.tipo ?? "particular";
  const emails = resolveEmails(nf);

  return {
    event: "nf_emitida",
    event_id: eventId,
    nf_id: nf.id,
    tipo,
    reenvio,
    numero: nf.numero,
    valor: Number(nf.valor) || 0,
    emissao: nf.emissao,
    pdf_url: nf.pdf_url,
    competencia_mes: nf.competencia_mes,
    competencia_ano: nf.competencia_ano,
    competencia_label: competenciaLabel(nf.competencia_mes, nf.competencia_ano),
    destinatario_nome: nf.destinatario_nome,
    destinatario_documento: nf.destinatario_documento,
    corpo_paciente_nome: nf.corpo_paciente_nome ?? nf.pacientes?.nome ?? null,
    corpo_paciente_cpf: nf.corpo_paciente_cpf ?? nf.pacientes?.cpf ?? null,
    corpo_numero_processo: nf.corpo_numero_processo ?? nf.pacientes?.numero_processo ?? null,
    corpo_total_sessoes: nf.corpo_total_sessoes,
    paciente_id: nf.paciente_id,
    paciente_nome: nf.pacientes?.nome ?? null,
    cobranca_id: nf.cobranca_id,
    to_email: emails.to,
    cc_emails: emails.cc,
    template_codigo: TEMPLATE_BY_TIPO[tipo] ?? "RQ.GPS.08.001",
    assunto_sugerido: buildAssunto(nf),
  };
}
