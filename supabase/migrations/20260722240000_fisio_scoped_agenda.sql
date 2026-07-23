-- Agenda: fisio clínico vê apenas agendamentos da própria coluna (fisioterapeuta_id).

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

GRANT EXECUTE ON FUNCTION public.staff_has_full_agenda_access() TO authenticated;

DROP POLICY IF EXISTS "auth select agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "scoped select agendamentos" ON public.agendamentos;

CREATE POLICY "scoped select agendamentos"
  ON public.agendamentos FOR SELECT TO authenticated
  USING (
    public.staff_has_full_agenda_access()
    OR (
      public.is_clinical_fisio_user()
      AND fisioterapeuta_id IS NOT NULL
      AND fisioterapeuta_id = public.current_fisioterapeuta_id()
    )
  );

DROP POLICY IF EXISTS "auth select fisio_disponibilidade" ON public.fisio_disponibilidade;
DROP POLICY IF EXISTS "scoped select fisio_disponibilidade" ON public.fisio_disponibilidade;

CREATE POLICY "scoped select fisio_disponibilidade"
  ON public.fisio_disponibilidade FOR SELECT TO authenticated
  USING (
    public.staff_has_full_agenda_access()
    OR fisioterapeuta_id = public.current_fisioterapeuta_id()
  );

DROP POLICY IF EXISTS "auth select fisio_indisponibilidade" ON public.fisio_indisponibilidade;
DROP POLICY IF EXISTS "scoped select fisio_indisponibilidade" ON public.fisio_indisponibilidade;

CREATE POLICY "scoped select fisio_indisponibilidade"
  ON public.fisio_indisponibilidade FOR SELECT TO authenticated
  USING (
    public.staff_has_full_agenda_access()
    OR fisioterapeuta_id = public.current_fisioterapeuta_id()
  );
