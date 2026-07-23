-- Hotfix: paciente_ve_proprio liberava SELECT de todos os pacientes para qualquer staff com role.

DROP POLICY IF EXISTS "authenticated all pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "auth select pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "paciente_ve_proprio" ON public.pacientes;
DROP POLICY IF EXISTS "scoped select pacientes" ON public.pacientes;

CREATE POLICY "paciente_ve_proprio"
  ON public.pacientes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "scoped select pacientes"
  ON public.pacientes FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(id));
