-- Fase 3.1: multi-fisioterapeuta por sessão + periodização de sessões

CREATE TYPE public.periodizacao_status AS ENUM ('planejada', 'em_andamento', 'concluida', 'cancelada');

CREATE TABLE IF NOT EXISTS public.sessao_fisioterapeutas (
  sessao_id uuid NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  fisioterapeuta_id uuid NOT NULL REFERENCES public.fisioterapeutas(id) ON DELETE CASCADE,
  principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sessao_id, fisioterapeuta_id)
);

CREATE INDEX IF NOT EXISTS idx_sessao_fisioterapeutas_fisio
  ON public.sessao_fisioterapeutas (fisioterapeuta_id);

CREATE TABLE IF NOT EXISTS public.periodizacao_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  numero_sessao integer NOT NULL CHECK (numero_sessao > 0),
  objetivo text,
  atividades_previstas text,
  status public.periodizacao_status NOT NULL DEFAULT 'planejada',
  sessao_id uuid REFERENCES public.sessoes(id) ON DELETE SET NULL,
  atualizado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, numero_sessao)
);

CREATE INDEX IF NOT EXISTS idx_periodizacao_sessoes_paciente
  ON public.periodizacao_sessoes (paciente_id, numero_sessao);

-- Backfill: cada sessão existente ganha o fisio principal na junção
INSERT INTO public.sessao_fisioterapeutas (sessao_id, fisioterapeuta_id, principal)
SELECT s.id, s.fisioterapeuta_id, true
FROM public.sessoes s
WHERE s.fisioterapeuta_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.sessao_fisioterapeutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodizacao_sessoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select sessao_fisioterapeutas"
    ON public.sessao_fisioterapeutas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff write sessao_fisioterapeutas"
    ON public.sessao_fisioterapeutas FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
      OR public.has_role(auth.uid(), 'fisio')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
      OR public.has_role(auth.uid(), 'fisio')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth select periodizacao_sessoes"
    ON public.periodizacao_sessoes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff write periodizacao_sessoes"
    ON public.periodizacao_sessoes FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
      OR public.has_role(auth.uid(), 'fisio')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
      OR public.has_role(auth.uid(), 'fisio')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sincroniza junção após insert/update em sessoes (mantém fisio principal)
CREATE OR REPLACE FUNCTION public.sync_sessao_fisioterapeuta_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fisioterapeuta_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.sessao_fisioterapeutas SET principal = false WHERE sessao_id = NEW.id;

  INSERT INTO public.sessao_fisioterapeutas (sessao_id, fisioterapeuta_id, principal)
  VALUES (NEW.id, NEW.fisioterapeuta_id, true)
  ON CONFLICT (sessao_id, fisioterapeuta_id)
  DO UPDATE SET principal = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sessao_fisioterapeuta_principal ON public.sessoes;
CREATE TRIGGER trg_sync_sessao_fisioterapeuta_principal
  AFTER INSERT OR UPDATE OF fisioterapeuta_id ON public.sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sessao_fisioterapeuta_principal();
