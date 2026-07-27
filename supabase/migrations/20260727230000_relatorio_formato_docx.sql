-- Formato DOCX (Unimed)
ALTER TABLE public.relatorios_atendimento
  DROP CONSTRAINT IF EXISTS relatorios_atendimento_formato_arquivo_check;

ALTER TABLE public.relatorios_atendimento
  ADD CONSTRAINT relatorios_atendimento_formato_arquivo_check
  CHECK (formato_arquivo IN ('pdf', 'xlsx', 'dual', 'docx'));

COMMENT ON COLUMN public.relatorios_atendimento.formato_arquivo IS
  'pdf | xlsx | dual | docx (Unimed institucional).';
