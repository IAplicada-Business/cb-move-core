-- Fluxo clínico: evolução sem agendamento prévio
-- - Fisio clínico vê todos os pacientes ativos (lista aberta)
-- - Salvar evolução resolve agendamento do dia ou cria atendimento avulso + sessão P
-- - registrar_atendimento_avulso também passa a criar sessão (frequência)

CREATE OR REPLACE FUNCTION public.fisio_can_access_paciente(p_paciente_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_has_full_patient_access() THEN
    RETURN true;
  END IF;

  IF public.is_clinical_fisio_user() THEN
    IF public.current_fisioterapeuta_id() IS NULL THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = p_paciente_id
        AND p.ativo = true
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public._resolver_ou_criar_sessao_evolucao(
  p_paciente_id uuid,
  p_fisioterapeuta_id uuid,
  p_data date,
  p_sessao_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessao_id uuid;
  v_agendamento record;
  v_hora time;
  v_inicio timestamptz;
BEGIN
  IF p_sessao_id IS NOT NULL THEN
    SELECT s.id INTO v_sessao_id
    FROM public.sessoes s
    WHERE s.id = p_sessao_id
      AND s.paciente_id = p_paciente_id
      AND s.data = p_data;

    IF v_sessao_id IS NOT NULL THEN
      RETURN v_sessao_id;
    END IF;
  END IF;

  SELECT s.id INTO v_sessao_id
  FROM public.sessoes s
  WHERE s.paciente_id = p_paciente_id
    AND s.data = p_data
  ORDER BY
    CASE WHEN s.fisioterapeuta_id = p_fisioterapeuta_id THEN 0 ELSE 1 END,
    CASE WHEN s.sigla IN ('P', 'RC') THEN 0 ELSE 1 END,
    s.created_at
  LIMIT 1;

  IF v_sessao_id IS NOT NULL THEN
    RETURN v_sessao_id;
  END IF;

  SELECT a.id, a.inicio, a.status
  INTO v_agendamento
  FROM public.agendamentos a
  WHERE a.paciente_id = p_paciente_id
    AND a.fisioterapeuta_id = p_fisioterapeuta_id
    AND (a.inicio AT TIME ZONE 'America/Sao_Paulo')::date = p_data
    AND a.status NOT IN ('cancelado', 'remarcacao')
  ORDER BY a.inicio
  LIMIT 1;

  IF v_agendamento.id IS NOT NULL THEN
    v_inicio := v_agendamento.inicio;
    v_hora := (v_inicio AT TIME ZONE 'America/Sao_Paulo')::time;

    IF v_agendamento.status IN ('agendado', 'confirmado') THEN
      UPDATE public.agendamentos
      SET status = 'realizado'::public.status_agendamento
      WHERE id = v_agendamento.id;
    END IF;

    INSERT INTO public.sessoes (paciente_id, data, hora, sigla, fisioterapeuta_id)
    VALUES (
      p_paciente_id,
      p_data,
      v_hora,
      'P'::public.frequencia_sigla,
      p_fisioterapeuta_id
    )
    RETURNING id INTO v_sessao_id;

    RETURN v_sessao_id;
  END IF;

  IF p_data = (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    v_inicio := now();
  ELSE
    v_inicio := (p_data + time '12:00') AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  v_hora := (v_inicio AT TIME ZONE 'America/Sao_Paulo')::time;

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
    p_fisioterapeuta_id,
    v_inicio,
    50,
    'Atendimento avulso',
    'realizado'::public.status_agendamento,
    auth.uid()
  );

  INSERT INTO public.sessoes (paciente_id, data, hora, sigla, fisioterapeuta_id)
  VALUES (
    p_paciente_id,
    p_data,
    v_hora,
    'P'::public.frequencia_sigla,
    p_fisioterapeuta_id
  )
  RETURNING id INTO v_sessao_id;

  RETURN v_sessao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_evolucao_com_atendimento(
  p_paciente_id uuid,
  p_fisioterapeuta_id uuid,
  p_data date,
  p_subjetivo text DEFAULT NULL,
  p_objetivo text DEFAULT NULL,
  p_plano text DEFAULT NULL,
  p_transcricao_raw text DEFAULT NULL,
  p_fonte text DEFAULT 'manual',
  p_sessao_id uuid DEFAULT NULL,
  p_criado_por uuid DEFAULT NULL
)
RETURNS public.prontuario_evolucoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fisio uuid;
  v_sessao_id uuid;
  v_ev public.prontuario_evolucoes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
    OR public.is_clinical_fisio_user()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar evolução';
  END IF;

  IF NOT public.fisio_can_access_paciente(p_paciente_id) THEN
    RAISE EXCEPTION 'Sem acesso ao paciente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pacientes p WHERE p.id = p_paciente_id AND p.ativo = true
  ) THEN
    RAISE EXCEPTION 'Paciente não encontrado ou inativo';
  END IF;

  v_fisio := coalesce(p_fisioterapeuta_id, public.current_fisioterapeuta_id());
  IF v_fisio IS NULL THEN
    RAISE EXCEPTION 'Fisioterapeuta não informado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fisioterapeutas f WHERE f.id = v_fisio AND f.ativo = true) THEN
    RAISE EXCEPTION 'Fisioterapeuta inválido ou inativo';
  END IF;

  v_sessao_id := public._resolver_ou_criar_sessao_evolucao(
    p_paciente_id,
    v_fisio,
    p_data,
    p_sessao_id
  );

  INSERT INTO public.prontuario_evolucoes (
    paciente_id,
    fisioterapeuta_id,
    sessao_id,
    data,
    subjetivo,
    objetivo,
    plano,
    transcricao_raw,
    fonte,
    criado_por
  )
  VALUES (
    p_paciente_id,
    v_fisio,
    v_sessao_id,
    p_data,
    NULLIF(trim(p_subjetivo), ''),
    NULLIF(trim(p_objetivo), ''),
    NULLIF(trim(p_plano), ''),
    NULLIF(trim(p_transcricao_raw), ''),
    p_fonte,
    coalesce(p_criado_por, auth.uid())
  )
  RETURNING * INTO v_ev;

  RETURN v_ev;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_evolucao_com_atendimento(
  uuid, uuid, date, text, text, text, text, text, uuid, uuid
) TO authenticated;

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
  v_data date;
  v_hora time;
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
  v_data := (v_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hora := (v_inicio AT TIME ZONE 'America/Sao_Paulo')::time;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.sessoes s
    WHERE s.paciente_id = p_paciente_id
      AND s.data = v_data
  ) THEN
    INSERT INTO public.sessoes (paciente_id, data, hora, sigla, fisioterapeuta_id)
    VALUES (
      p_paciente_id,
      v_data,
      v_hora,
      'P'::public.frequencia_sigla,
      v_fisio
    );
  END IF;

  RETURN QUERY
  SELECT v_agendamento_id, p_paciente_id, v_inicio;
END;
$$;
