-- Indexes em cobrancas
CREATE INDEX IF NOT EXISTS idx_cobrancas_paciente ON public.cobrancas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_competencia ON public.cobrancas(competencia_ano, competencia_mes);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON public.cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_vencimento ON public.cobrancas(vencimento);
-- Indexes em notas_fiscais
CREATE INDEX IF NOT EXISTS idx_nf_paciente ON public.notas_fiscais(paciente_id);
CREATE INDEX IF NOT EXISTS idx_nf_emissao ON public.notas_fiscais(emissao);
CREATE INDEX IF NOT EXISTS idx_nf_status ON public.notas_fiscais(status);
-- Indexes em agendamentos
CREATE INDEX IF NOT EXISTS idx_agend_inicio ON public.agendamentos(inicio);
CREATE INDEX IF NOT EXISTS idx_agend_fisio ON public.agendamentos(fisioterapeuta_id);
-- Indexes em sessoes
CREATE INDEX IF NOT EXISTS idx_sessoes_data ON public.sessoes(data);
CREATE INDEX IF NOT EXISTS idx_sessoes_paciente ON public.sessoes(paciente_id);
