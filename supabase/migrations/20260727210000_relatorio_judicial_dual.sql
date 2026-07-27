-- Judicial: PDF + XLSX na mesma competência
ALTER TABLE public.relatorios_atendimento
  ADD COLUMN IF NOT EXISTS xlsx_url text;

ALTER TABLE public.relatorios_atendimento
  DROP CONSTRAINT IF EXISTS relatorios_atendimento_formato_arquivo_check;

ALTER TABLE public.relatorios_atendimento
  ADD CONSTRAINT relatorios_atendimento_formato_arquivo_check
  CHECK (formato_arquivo IN ('pdf', 'xlsx', 'dual'));

COMMENT ON COLUMN public.relatorios_atendimento.xlsx_url IS
  'Path no storage do XLSX SharePoint (judicial). Null quando só PDF.';

COMMENT ON COLUMN public.relatorios_atendimento.formato_arquivo IS
  'pdf | xlsx | dual (judicial: PDF + XLSX).';
