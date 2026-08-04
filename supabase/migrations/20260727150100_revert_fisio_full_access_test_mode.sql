-- Reverte test mode: fisio volta ao escopo por paciente vinculado.

DROP FUNCTION IF EXISTS public.fisio_full_access_test_mode();

CREATE OR REPLACE FUNCTION public.staff_has_full_agenda_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.staff_has_full_patient_access()
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'membro'::public.app_role
      )
      AND public.current_fisioterapeuta_id() IS NULL
    );
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
