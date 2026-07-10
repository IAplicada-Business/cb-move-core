-- Prontuário: evoluções clínicas S/O/P (formaliza tabela usada em produção)

CREATE TABLE IF NOT EXISTS public.prontuario_evolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  fisioterapeuta_id uuid REFERENCES public.fisioterapeutas(id),
  sessao_id uuid REFERENCES public.sessoes(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  subjetivo text,
  objetivo text,
  plano text,
  transcricao_raw text,
  fonte text CHECK (fonte IS NULL OR fonte IN ('manual', 'audio_ia', 'sites_import')),
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_prontuario_evolucoes_paciente_data
  ON public.prontuario_evolucoes (paciente_id, data DESC);

ALTER TABLE public.prontuario_evolucoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select prontuario_evolucoes"
    ON public.prontuario_evolucoes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fisio insert prontuario_evolucoes"
    ON public.prontuario_evolucoes FOR INSERT TO authenticated WITH CHECK (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fisio')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fisio update prontuario_evolucoes"
    ON public.prontuario_evolucoes FOR UPDATE TO authenticated USING (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fisio')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "adm delete prontuario_evolucoes"
    ON public.prontuario_evolucoes FOR DELETE TO authenticated USING (
      public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
