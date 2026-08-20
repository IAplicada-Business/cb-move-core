-- P0: RLS evoluções alinhado a is_clinical_fisio_user (membro + fisioterapeuta_id).
-- P2: fisio_can_access_paciente inclui agendamento na coluna do fisio.
-- P1: RPCs para atendimento avulso (busca + registro retroativo).

DROP POLICY IF EXISTS "scoped insert prontuario_evolucoes" ON public.prontuario_evolucoes;
CREATE POLICY "scoped insert prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
    OR (
      public.is_clinical_fisio_user()
      AND public.fisio_can_access_paciente(paciente_id)
    )
  );

DROP POLICY IF EXISTS "scoped update prontuario_evolucoes" ON public.prontuario_evolucoes;
CREATE POLICY "scoped update prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR UPDATE TO authenticated
  USING (
    assinado_em IS NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
      OR (
        public.is_clinical_fisio_user()
        AND public.fisio_can_access_paciente(paciente_id)
      )
    )
  );

DROP POLICY IF EXISTS "scoped delete prontuario_evolucoes" ON public.prontuario_evolucoes;
CREATE POLICY "scoped delete prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
    OR (
      public.is_clinical_fisio_user()
      AND public.fisio_can_access_paciente(paciente_id)
    )
  );

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
    FROM public.agendamentos a
    WHERE a.paciente_id = p_paciente_id
      AND a.fisioterapeuta_id = v_fisio
      AND a.status NOT IN ('cancelado', 'remarcacao')
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

CREATE OR REPLACE FUNCTION public.buscar_pacientes_atendimento_avulso(p_query text)
RETURNS TABLE(id uuid, nome text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_clinical_fisio_user() AND NOT public.staff_has_full_patient_access() THEN
    RAISE EXCEPTION 'Sem permissão para buscar pacientes';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nome
  FROM public.pacientes p
  WHERE p.ativo = true
    AND (
      trim(coalesce(p_query, '')) = ''
      OR p.nome ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY p.nome
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_pacientes_atendimento_avulso(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_atendimento_avulso(
  p_paciente_id uuid,
  p_inicio timestamptz DEFAULT now()
)
RETURNS TABLE(agendamento_id uuid, paciente_id uuid, inicio timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fisio uuid;
  v_agendamento_id uuid;
  v_inicio timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_clinical_fisio_user() THEN
    RAISE EXCEPTION 'Somente fisioterapeuta clínico pode registrar atendimento avulso';
  END IF;

  v_fisio := public.current_fisioterapeuta_id();
  IF v_fisio IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a um fisioterapeuta';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pacientes p WHERE p.id = p_paciente_id AND p.ativo = true
  ) THEN
    RAISE EXCEPTION 'Paciente não encontrado ou inativo';
  END IF;

  v_inicio := coalesce(p_inicio, now());

  INSERT INTO public.agendamentos (
    paciente_id,
    fisioterapeuta_id,
    inicio,
    duracao_min,
    servico,
    status,
    criado_por
  )
  VALUES (
    p_paciente_id,
    v_fisio,
    v_inicio,
    50,
    'Atendimento avulso',
    'realizado'::public.status_agendamento,
    auth.uid()
  )
  RETURNING id, agendamentos.inicio INTO v_agendamento_id, v_inicio;

  RETURN QUERY
  SELECT v_agendamento_id, p_paciente_id, v_inicio;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_atendimento_avulso(uuid, timestamptz) TO authenticated;
