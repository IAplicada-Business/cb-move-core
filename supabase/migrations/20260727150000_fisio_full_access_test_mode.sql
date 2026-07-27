-- TEMP TEST MODE: fisio clínico vê todos os pacientes.
-- Reverter: aplicar migration 20260727150100_revert_fisio_full_access_test_mode.sql

CREATE OR REPLACE FUNCTION public.fisio_full_access_test_mode()
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT true;
$$;

CREATE OR REPLACE FUNCTION public.fisio_can_access_paciente(p_paciente_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fisio uuid;
BEGIN
  IF public.staff_has_full_patient_access() THEN
    RETURN true;
  END IF;

  IF public.fisio_full_access_test_mode() AND public.is_clinical_fisio_user() THEN
    RETURN true;
  END IF;

  IF NOT public.is_clinical_fisio_user() THEN
    RETURN false;
  END IF;

  v_fisio := public.current_fisioterapeuta_id();
  IF v_fisio IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = p_paciente_id AND p.fisioterapeuta_id = v_fisio
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = p_paciente_id AND p.consulta_experimental_fisio_id = v_fisio
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sessoes s
    JOIN public.sessao_fisioterapeutas sf ON sf.sessao_id = s.id
    WHERE s.paciente_id = p_paciente_id AND sf.fisioterapeuta_id = v_fisio
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prontuario_evolucoes pe
    WHERE pe.paciente_id = p_paciente_id AND pe.fisioterapeuta_id = v_fisio
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fisio_full_access_test_mode() TO authenticated;
