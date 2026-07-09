-- Frequência e dias da semana para extrato financeiro (planilha cliente)
-- 2026-07-09

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS frequencia_atendimento text,
  ADD COLUMN IF NOT EXISTS dias_semana text;

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS frequencia_atendimento text,
  ADD COLUMN IF NOT EXISTS dias_semana text;

COMMENT ON COLUMN public.pacientes.frequencia_atendimento IS 'Ex.: 2x semana triplo — padrão para novas cobranças';
COMMENT ON COLUMN public.pacientes.dias_semana IS 'Ex.: 2ª e 5ª (triplos) — padrão para novas cobranças';
COMMENT ON COLUMN public.cobrancas.frequencia_atendimento IS 'Frequência da cobrança no mês (extrato financeiro)';
COMMENT ON COLUMN public.cobrancas.dias_semana IS 'Dias da semana da cobrança no mês (extrato financeiro)';
