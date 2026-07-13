-- Disponibilidade recorrente e indisponibilidade pontual dos fisioterapeutas

CREATE TABLE IF NOT EXISTS public.fisio_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fisioterapeuta_id uuid NOT NULL REFERENCES public.fisioterapeutas(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fisio_disp_hora_check CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_fisio_disp_fisio
  ON public.fisio_disponibilidade(fisioterapeuta_id);
CREATE INDEX IF NOT EXISTS idx_fisio_disp_dia
  ON public.fisio_disponibilidade(dia_semana);

CREATE TABLE IF NOT EXISTS public.fisio_indisponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fisioterapeuta_id uuid NOT NULL REFERENCES public.fisioterapeutas(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  motivo text NOT NULL DEFAULT 'outro'
    CHECK (motivo IN ('ferias', 'intervalo', 'outro')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fisio_indisp_periodo_check CHECK (fim > inicio)
);

CREATE INDEX IF NOT EXISTS idx_fisio_indisp_fisio
  ON public.fisio_indisponibilidade(fisioterapeuta_id);
CREATE INDEX IF NOT EXISTS idx_fisio_indisp_periodo
  ON public.fisio_indisponibilidade(inicio, fim);

ALTER TABLE public.fisio_disponibilidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fisio_indisponibilidade ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select fisio_disponibilidade"
    ON public.fisio_disponibilidade FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec write fisio_disponibilidade"
    ON public.fisio_disponibilidade FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec update fisio_disponibilidade"
    ON public.fisio_disponibilidade FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec delete fisio_disponibilidade"
    ON public.fisio_disponibilidade FOR DELETE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth select fisio_indisponibilidade"
    ON public.fisio_indisponibilidade FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec write fisio_indisponibilidade"
    ON public.fisio_indisponibilidade FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec update fisio_indisponibilidade"
    ON public.fisio_indisponibilidade FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec delete fisio_indisponibilidade"
    ON public.fisio_indisponibilidade FOR DELETE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fisio_disponibilidade TO authenticated;
GRANT ALL ON public.fisio_disponibilidade TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fisio_indisponibilidade TO authenticated;
GRANT ALL ON public.fisio_indisponibilidade TO service_role;
