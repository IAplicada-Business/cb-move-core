-- Membro com profiles.fisioterapeuta_id = fisio clínico (visão restrita).
-- Admin/gestão/recepção mantêm acesso total (papéis exatos, sem equivalência membro).

CREATE OR REPLACE FUNCTION public.staff_has_full_patient_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'gestao'::public.app_role, 'recepcao'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_clinical_fisio_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.staff_has_full_patient_access()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'fisio'::public.app_role
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'membro'::public.app_role
        )
        AND public.current_fisioterapeuta_id() IS NOT NULL
      )
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

GRANT EXECUTE ON FUNCTION public.staff_has_full_patient_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinical_fisio_user() TO authenticated;

-- SELECT restrito (idempotente)
DROP POLICY IF EXISTS "auth select pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "scoped select pacientes" ON public.pacientes;
CREATE POLICY "scoped select pacientes"
  ON public.pacientes FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(id));

DROP POLICY IF EXISTS "auth select sessoes" ON public.sessoes;
DROP POLICY IF EXISTS "scoped select sessoes" ON public.sessoes;
CREATE POLICY "scoped select sessoes"
  ON public.sessoes FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(paciente_id));

DROP POLICY IF EXISTS "auth select agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "scoped select agendamentos" ON public.agendamentos;
CREATE POLICY "scoped select agendamentos"
  ON public.agendamentos FOR SELECT TO authenticated
  USING (
    (paciente_id IS NOT NULL AND public.fisio_can_access_paciente(paciente_id))
    OR (
      paciente_id IS NULL
      AND (
        NOT public.is_clinical_fisio_user()
        OR fisioterapeuta_id IS NULL
        OR fisioterapeuta_id = public.current_fisioterapeuta_id()
      )
    )
  );

DROP POLICY IF EXISTS "auth select relatorios" ON public.relatorios_atendimento;
DROP POLICY IF EXISTS "scoped select relatorios" ON public.relatorios_atendimento;
CREATE POLICY "scoped select relatorios"
  ON public.relatorios_atendimento FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(paciente_id));

DROP POLICY IF EXISTS "auth select relatorio_atendimento_linhas" ON public.relatorio_atendimento_linhas;
DROP POLICY IF EXISTS "scoped select relatorio_atendimento_linhas" ON public.relatorio_atendimento_linhas;
CREATE POLICY "scoped select relatorio_atendimento_linhas"
  ON public.relatorio_atendimento_linhas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.relatorios_atendimento r
      WHERE r.id = relatorio_id
        AND public.fisio_can_access_paciente(r.paciente_id)
    )
  );

DROP POLICY IF EXISTS "auth select periodizacao_sessoes" ON public.periodizacao_sessoes;
DROP POLICY IF EXISTS "scoped select periodizacao_sessoes" ON public.periodizacao_sessoes;
CREATE POLICY "scoped select periodizacao_sessoes"
  ON public.periodizacao_sessoes FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(paciente_id));

DROP POLICY IF EXISTS "auth select inst_aplic" ON public.instrumentos_aplicados;
DROP POLICY IF EXISTS "scoped select inst_aplic" ON public.instrumentos_aplicados;
CREATE POLICY "scoped select inst_aplic"
  ON public.instrumentos_aplicados FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(paciente_id));

DROP POLICY IF EXISTS "auth select hist" ON public.pacientes_status_historico;
DROP POLICY IF EXISTS "scoped select hist" ON public.pacientes_status_historico;
CREATE POLICY "scoped select hist"
  ON public.pacientes_status_historico FOR SELECT TO authenticated
  USING (public.fisio_can_access_paciente(paciente_id));

DROP POLICY IF EXISTS "auth select sessao_fisioterapeutas" ON public.sessao_fisioterapeutas;
DROP POLICY IF EXISTS "scoped select sessao_fisioterapeutas" ON public.sessao_fisioterapeutas;
CREATE POLICY "scoped select sessao_fisioterapeutas"
  ON public.sessao_fisioterapeutas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessoes s
      WHERE s.id = sessao_id
        AND public.fisio_can_access_paciente(s.paciente_id)
    )
  );

-- RPCs de PDF respeitam escopo clínico
CREATE OR REPLACE FUNCTION public.import_relatorio_atendimento_pdf(
  p_paciente_id uuid,
  p_competencia_mes int,
  p_competencia_ano int,
  p_pdf_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_modelo public.modelo_relatorio;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF public.is_clinical_fisio_user()
    AND NOT public.fisio_can_access_paciente(p_paciente_id) THEN
    RAISE EXCEPTION 'Sem permissao para importar relatorio deste paciente';
  END IF;

  IF NOT (
    public.staff_has_full_patient_access()
    OR public.is_clinical_fisio_user()
    OR public.has_role(auth.uid(), 'membro')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para importar relatorio de atendimento';
  END IF;

  IF p_pdf_url IS NULL OR length(trim(p_pdf_url)) = 0 THEN
    RAISE EXCEPTION 'URL do PDF invalida';
  END IF;

  SELECT id INTO v_id
  FROM public.relatorios_atendimento
  WHERE paciente_id = p_paciente_id
    AND competencia_mes = p_competencia_mes
    AND competencia_ano = p_competencia_ano
    AND modelo_pdf = 'documento_fisico'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.relatorios_atendimento
    SET pdf_url = p_pdf_url,
        assinado = true,
        assinado_em = COALESCE(assinado_em, now())
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  SELECT COALESCE(modelo_relatorio_preferido, 'convencional'::public.modelo_relatorio)
  INTO v_modelo
  FROM public.pacientes
  WHERE id = p_paciente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente nao encontrado';
  END IF;

  INSERT INTO public.relatorios_atendimento (
    paciente_id,
    modelo,
    competencia_mes,
    competencia_ano,
    pdf_url,
    assinado,
    assinado_em,
    modelo_pdf
  )
  VALUES (
    p_paciente_id,
    v_modelo,
    p_competencia_mes,
    p_competencia_ano,
    p_pdf_url,
    true,
    now(),
    'documento_fisico'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_relatorio_atendimento_pdf_url(
  p_relatorio_id uuid,
  p_pdf_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT paciente_id INTO v_paciente_id
  FROM public.relatorios_atendimento
  WHERE id = p_relatorio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relatorio nao encontrado';
  END IF;

  IF public.is_clinical_fisio_user()
    AND NOT public.fisio_can_access_paciente(v_paciente_id) THEN
    RAISE EXCEPTION 'Sem permissao para atualizar PDF deste relatorio';
  END IF;

  IF p_pdf_url IS NULL THEN
    IF NOT public.staff_has_full_patient_access() THEN
      RAISE EXCEPTION 'Sem permissao para remover PDF do relatorio';
    END IF;
  ELSIF NOT (
    public.staff_has_full_patient_access()
    OR public.is_clinical_fisio_user()
    OR public.has_role(auth.uid(), 'membro')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para atualizar PDF do relatorio';
  END IF;

  UPDATE public.relatorios_atendimento
  SET pdf_url = p_pdf_url,
      assinado = CASE WHEN p_pdf_url IS NULL THEN false ELSE assinado END,
      assinado_em = CASE WHEN p_pdf_url IS NULL THEN NULL ELSE assinado_em END
  WHERE id = p_relatorio_id;
END;
$$;
