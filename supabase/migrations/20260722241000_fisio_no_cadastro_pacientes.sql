-- Fisio clínico não cadastra pacientes; vínculo inicia no 1º agendamento na coluna do fisio.

CREATE OR REPLACE FUNCTION public.staff_can_manage_pacientes()
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

GRANT EXECUTE ON FUNCTION public.staff_can_manage_pacientes() TO authenticated;

DROP POLICY IF EXISTS "rec write pacientes" ON public.pacientes;
CREATE POLICY "rec write pacientes"
  ON public.pacientes FOR INSERT TO authenticated
  WITH CHECK (public.staff_can_manage_pacientes());

DROP POLICY IF EXISTS "rec update pacientes" ON public.pacientes;
CREATE POLICY "rec update pacientes"
  ON public.pacientes FOR UPDATE TO authenticated
  USING (public.staff_can_manage_pacientes())
  WITH CHECK (public.staff_can_manage_pacientes());

DROP POLICY IF EXISTS "gst delete pacientes" ON public.pacientes;
CREATE POLICY "gst delete pacientes"
  ON public.pacientes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'gestao'::public.app_role)
    )
  );

CREATE OR REPLACE FUNCTION public.link_paciente_fisio_por_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.paciente_id IS NULL OR NEW.fisioterapeuta_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.pacientes p
  SET
    consulta_experimental_fisio_id = COALESCE(p.consulta_experimental_fisio_id, NEW.fisioterapeuta_id),
    consulta_experimental_em = COALESCE(
      p.consulta_experimental_em,
      (NEW.inicio AT TIME ZONE 'America/Sao_Paulo')::date
    )
  WHERE p.id = NEW.paciente_id
    AND (
      p.consulta_experimental_fisio_id IS NULL
      OR p.consulta_experimental_em IS NULL
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_link_paciente_fisio ON public.agendamentos;
CREATE TRIGGER trg_agendamento_link_paciente_fisio
  AFTER INSERT OR UPDATE OF paciente_id, fisioterapeuta_id, inicio
  ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.link_paciente_fisio_por_agendamento();
