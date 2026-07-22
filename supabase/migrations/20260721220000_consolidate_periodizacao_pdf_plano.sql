-- Consolida periodizacao_pdf_url, plano_total_sessoes e RPC para upload pelo prontuario

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS periodizacao_pdf_url text,
  ADD COLUMN IF NOT EXISTS plano_total_sessoes int CHECK (plano_total_sessoes IS NULL OR plano_total_sessoes > 0);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'periodizacao_drive_url'
  ) THEN
    UPDATE public.pacientes
    SET periodizacao_pdf_url = COALESCE(periodizacao_pdf_url, periodizacao_drive_url)
    WHERE periodizacao_drive_url IS NOT NULL;
    ALTER TABLE public.pacientes DROP COLUMN periodizacao_drive_url;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_periodizacao_pdf_url(
  p_paciente_id uuid,
  p_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'fisio')
    OR public.has_role(auth.uid(), 'membro')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para atualizar periodizacao PDF';
  END IF;

  UPDATE public.pacientes
  SET periodizacao_pdf_url = p_url
  WHERE id = p_paciente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente nao encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_periodizacao_pdf_url(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_periodizacao_pdf_url(uuid, text) TO authenticated;
