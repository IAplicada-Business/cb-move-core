import { supabase } from "@/integrations/supabase/client";
import {
  buildExtratoFinanceiro,
  type ExtratoFinanceiroRawRow,
  type ExtratoFinanceiroResumo,
} from "@/lib/domain/extrato-financeiro";

export async function fetchExtratoFinanceiro(
  mes: number,
  ano: number,
): Promise<ExtratoFinanceiroResumo> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select(
      `
      id,
      paciente_id,
      tipo,
      valor,
      status,
      regime,
      servico,
      observacoes,
      qtd_sessoes,
      frequencia_atendimento,
      dias_semana,
      pago_em,
      pacientes (
        nome,
        tipo,
        criado_em,
        valor_mensal,
        valor_sessao,
        regime_cobranca,
        frequencia_atendimento,
        dias_semana,
        convenios ( nome )
      )
    `,
    )
    .eq("competencia_mes", mes)
    .eq("competencia_ano", ano)
    .neq("status", "cancelado")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return buildExtratoFinanceiro((data ?? []) as unknown as ExtratoFinanceiroRawRow[], mes, ano);
}
