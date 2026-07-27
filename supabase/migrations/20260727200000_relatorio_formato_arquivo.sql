-- Formato de saída do relatório de atendimento (pdf | xlsx)
ALTER TABLE public.relatorios_atendimento
  ADD COLUMN IF NOT EXISTS formato_arquivo text NOT NULL DEFAULT 'pdf';

ALTER TABLE public.relatorios_atendimento
  DROP CONSTRAINT IF EXISTS relatorios_atendimento_formato_arquivo_check;

ALTER TABLE public.relatorios_atendimento
  ADD CONSTRAINT relatorios_atendimento_formato_arquivo_check
  CHECK (formato_arquivo IN ('pdf', 'xlsx'));

COMMENT ON COLUMN public.relatorios_atendimento.formato_arquivo IS
  'Formato do arquivo gerado: pdf (grade/legado/unimed) ou xlsx (sharepoint judicial).';
