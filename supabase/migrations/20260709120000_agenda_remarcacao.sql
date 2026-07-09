-- Agenda: status remarcacao, vínculos de série/remanejamento e histórico

DO $$ BEGIN
  ALTER TYPE public.status_agendamento ADD VALUE 'remarcacao';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS serie_id uuid,
  ADD COLUMN IF NOT EXISTS remarcado_de_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remarcado_para_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_serie
  ON public.agendamentos(serie_id)
  WHERE serie_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agendamento_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('status', 'remanejamento')),
  status_anterior text,
  status_novo text,
  inicio_anterior timestamptz,
  inicio_novo timestamptz,
  escopo text,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agendamento_historico_ag
  ON public.agendamento_historico(agendamento_id, created_at DESC);

ALTER TABLE public.agendamento_historico ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select agendamento_historico"
    ON public.agendamento_historico FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rec insert agendamento_historico"
    ON public.agendamento_historico FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.agendamento_historico TO authenticated;
GRANT ALL ON public.agendamento_historico TO service_role;
