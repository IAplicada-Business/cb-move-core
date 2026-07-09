-- Avisos do dia na agenda (banner operacional)

CREATE TABLE IF NOT EXISTS public.agenda_avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  texto text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_avisos_data ON public.agenda_avisos(data);

ALTER TABLE public.agenda_avisos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select agenda_avisos"
    ON public.agenda_avisos FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec insert agenda_avisos"
    ON public.agenda_avisos FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec update agenda_avisos"
    ON public.agenda_avisos FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.agenda_avisos TO authenticated;
GRANT ALL ON public.agenda_avisos TO service_role;
