-- Test mode (acordado com cliente ago/2026): fisio clínico vê agenda completa enquanto
-- fisio_full_access_test_mode() = true. Reverter junto com 20260727150100.

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
      public.fisio_full_access_test_mode()
      AND public.is_clinical_fisio_user()
    )
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
