-- Gestão/recepção também registram consulta experimental no prontuário ao cadastrar paciente.

DROP POLICY IF EXISTS "scoped insert prontuario_evolucoes" ON public.prontuario_evolucoes;
DROP POLICY IF EXISTS "scoped update prontuario_evolucoes" ON public.prontuario_evolucoes;
DROP POLICY IF EXISTS "adm delete prontuario_evolucoes" ON public.prontuario_evolucoes;

CREATE POLICY "scoped insert prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
    OR (
      public.has_role(auth.uid(), 'fisio')
      AND public.fisio_can_access_paciente(paciente_id)
    )
  );

CREATE POLICY "scoped update prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
    OR (
      public.has_role(auth.uid(), 'fisio')
      AND public.fisio_can_access_paciente(paciente_id)
    )
  );

CREATE POLICY "scoped delete prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
    OR (
      public.has_role(auth.uid(), 'fisio')
      AND public.fisio_can_access_paciente(paciente_id)
    )
  );
