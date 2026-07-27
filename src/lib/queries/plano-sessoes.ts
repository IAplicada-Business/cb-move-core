import { supabase } from "@/integrations/supabase/client";
import {
  resolverDiasSemanaExtrato,
  resolverFrequenciaExtrato,
} from "@/lib/domain/atendimento-cadastro";
import {
  montarResumoPlanoSessoesMensal,
  type ResumoPlanoSessoesMensal,
} from "@/lib/domain/plano-sessoes-mensal";

function monthRange(mes: number, ano: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  return { inicio, fim };
}

export type AgendamentoPlanoMes = {
  id: string;
  inicio: string;
  status: string;
  serie_id: string | null;
};

export async function fetchAgendamentosAtivosPacienteMes(
  pacienteId: string,
  mes: number,
  ano: number,
): Promise<AgendamentoPlanoMes[]> {
  const { inicio, fim } = monthRange(mes, ano);

  const { data, error } = await supabase
    .from("agendamentos")
    .select("id, inicio, status, serie_id")
    .eq("paciente_id", pacienteId)
    .gte("inicio", inicio)
    .lt("inicio", fim)
    .in("status", ["agendado", "confirmado", "realizado", "faltou"])
    .order("inicio", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AgendamentoPlanoMes[];
}

export async function fetchPlanoSessoesMensalPaciente(
  pacienteId: string,
  mes: number,
  ano: number,
): Promise<ResumoPlanoSessoesMensal> {
  const { inicio, fim } = monthRange(mes, ano);

  const [pacienteRes, cobrancaRes, agendamentosRes] = await Promise.all([
    supabase
      .from("pacientes")
      .select("frequencia_atendimento, dias_semana")
      .eq("id", pacienteId)
      .single(),
    supabase
      .from("cobrancas")
      .select("qtd_sessoes, frequencia_atendimento, dias_semana")
      .eq("paciente_id", pacienteId)
      .eq("competencia_mes", mes)
      .eq("competencia_ano", ano)
      .maybeSingle(),
    supabase
      .from("agendamentos")
      .select("id, inicio, status")
      .eq("paciente_id", pacienteId)
      .gte("inicio", inicio)
      .lt("inicio", fim)
      .in("status", ["agendado", "confirmado", "realizado", "faltou"])
      .order("inicio", { ascending: true }),
  ]);

  if (pacienteRes.error) throw pacienteRes.error;
  if (cobrancaRes.error) throw cobrancaRes.error;
  if (agendamentosRes.error) throw agendamentosRes.error;

  const cobranca = cobrancaRes.data as {
    qtd_sessoes: number | null;
    frequencia_atendimento: string | null;
    dias_semana: string | null;
  } | null;

  const paciente = pacienteRes.data as {
    frequencia_atendimento: string | null;
    dias_semana: string | null;
  } | null;

  const frequenciaLabel = resolverFrequenciaExtrato(
    cobranca?.frequencia_atendimento,
    paciente?.frequencia_atendimento,
    null,
  );

  const diasSemanaLabel = resolverDiasSemanaExtrato(cobranca?.dias_semana, paciente?.dias_semana);

  return montarResumoPlanoSessoesMensal({
    mes,
    ano,
    frequenciaLabel,
    diasSemanaLabel,
    qtdSessoesCobranca: cobranca?.qtd_sessoes,
    agendamentos: (agendamentosRes.data ?? []) as Array<{
      id: string;
      inicio: string;
      status: string;
    }>,
  });
}
