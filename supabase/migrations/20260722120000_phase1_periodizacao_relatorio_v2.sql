-- Fase 1: consulta experimental, periodização enriquecida, relatório de atendimentos grade v2

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS consulta_experimental_em date,
  ADD COLUMN IF NOT EXISTS consulta_experimental_fisio_id uuid REFERENCES public.fisioterapeutas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consulta_experimental_observacoes text,
  ADD COLUMN IF NOT EXISTS periodizacao_pdf_url text;

ALTER TABLE public.periodizacao_sessoes
  ADD COLUMN IF NOT EXISTS fisioterapeuta_id uuid REFERENCES public.fisioterapeutas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drive_doc_url text;

ALTER TABLE public.relatorios_atendimento
  ADD COLUMN IF NOT EXISTS num_sessoes int,
  ADD COLUMN IF NOT EXISTS valor_sessao numeric(10,2),
  ADD COLUMN IF NOT EXISTS valor_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS frequencia_texto text,
  ADD COLUMN IF NOT EXISTS carga_horaria text DEFAULT '1h25',
  ADD COLUMN IF NOT EXISTS modelo_pdf text DEFAULT 'grade_v2';

CREATE TABLE IF NOT EXISTS public.relatorio_atendimento_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.relatorios_atendimento(id) ON DELETE CASCADE,
  data date NOT NULL,
  carga_horaria text NOT NULL DEFAULT '1h25',
  fisioterapeuta_id uuid REFERENCES public.fisioterapeutas(id) ON DELETE SET NULL,
  fisioterapeuta_nome text,
  ordem_no_dia int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relatorio_linhas_relatorio
  ON public.relatorio_atendimento_linhas (relatorio_id, data, ordem_no_dia);

ALTER TABLE public.relatorio_atendimento_linhas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select relatorio_atendimento_linhas"
    ON public.relatorio_atendimento_linhas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff write relatorio_atendimento_linhas"
    ON public.relatorio_atendimento_linhas FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'fisio')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'fisio')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
