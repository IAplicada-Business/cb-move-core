-- Fase 3.2: RLS restritiva por fisioterapeuta (usa sessao_fisioterapeutas + profiles)

CREATE OR REPLACE FUNCTION public.current_fisioterapeuta_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fisioterapeuta_id FROM public.profiles WHERE id = auth.uid()
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
  IF public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao') THEN
    RETURN true;
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

-- Substitui SELECT aberto por filtro para fisios
DROP POLICY IF EXISTS "auth select prontuario_evolucoes" ON public.prontuario_evolucoes;

CREATE POLICY "scoped select prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(paciente_id));

-- Fisio só insere/atualiza evoluções de pacientes que pode acessar
DROP POLICY IF EXISTS "fisio insert prontuario_evolucoes" ON public.prontuario_evolucoes;
DROP POLICY IF EXISTS "fisio update prontuario_evolucoes" ON public.prontuario_evolucoes;

CREATE POLICY "scoped insert prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'fisio')
      AND public.fisio_can_access_paciente(paciente_id)
    )
  );

CREATE POLICY "scoped update prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'fisio')
      AND public.fisio_can_access_paciente(paciente_id)
    )
  );
