-- Valida conflito de horário do fisioterapeuta na remarcação em lote

CREATE OR REPLACE FUNCTION public.remarcar_agendamentos_lote(
  p_agendamento_id uuid,
  p_novo_inicio timestamptz,
  p_escopo text,
  p_novo_fisio_id uuid DEFAULT NULL,
  p_duracao_min int DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem public.agendamentos%ROWTYPE;
  v_delta interval;
  v_fisio_destino uuid;
  v_duracao int;
  v_count int := 0;
  v_primeiro_novo_id uuid := NULL;
  v_freq_perdida int := 0;
  v_ag record;
  v_novo_id uuid;
  v_novo_inicio timestamptz;
  v_data_antiga date;
  v_data_nova date;
  v_hora time;
  v_sigla_origem public.frequencia_sigla;
  v_sigla_destino public.frequencia_sigla;
  v_sessao_id uuid;
  v_plan record;
  v_hora_plan record;
  v_conflito int;
BEGIN
  IF p_escopo NOT IN ('pontual', 'semana', 'serie_mes') THEN
    RAISE EXCEPTION 'Escopo inválido: %', p_escopo;
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para remarcar agendamentos';
  END IF;

  SELECT * INTO v_origem
  FROM public.agendamentos
  WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_origem.paciente_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento sem paciente';
  END IF;

  IF v_origem.status NOT IN ('agendado', 'confirmado') THEN
    RAISE EXCEPTION 'Só é possível remarcar agendamentos ativos (agendado ou confirmado)';
  END IF;

  v_delta := p_novo_inicio - v_origem.inicio;
  v_fisio_destino := COALESCE(p_novo_fisio_id, v_origem.fisioterapeuta_id);
  v_duracao := COALESCE(p_duracao_min, v_origem.duracao_min);

  CREATE TEMP TABLE _move_plans (
    paciente_id uuid NOT NULL,
    data_antiga date NOT NULL,
    data_nova date NOT NULL,
    hora time,
    fisioterapeuta_id uuid,
    PRIMARY KEY (paciente_id, data_antiga, data_nova)
  ) ON COMMIT DROP;

  CREATE TEMP TABLE _hora_updates (
    paciente_id uuid NOT NULL,
    data date NOT NULL,
    hora time,
    fisioterapeuta_id uuid,
    PRIMARY KEY (paciente_id, data)
  ) ON COMMIT DROP;

  CREATE TEMP TABLE _remarcar_targets (
    agendamento_id uuid PRIMARY KEY,
    novo_inicio timestamptz NOT NULL
  ) ON COMMIT DROP;

  FOR v_ag IN
    SELECT a.*
    FROM public.agendamentos a
    WHERE (
      p_escopo = 'pontual'
      AND a.id = p_agendamento_id
    ) OR (
      p_escopo <> 'pontual'
      AND a.paciente_id = v_origem.paciente_id
      AND a.inicio >= v_origem.inicio
      AND a.status IN ('agendado', 'confirmado')
      AND (v_origem.serie_id IS NULL OR a.serie_id = v_origem.serie_id)
      AND (
        (
          p_escopo = 'semana'
          AND date_trunc(
            'week',
            a.inicio AT TIME ZONE 'America/Sao_Paulo'
          ) = date_trunc(
            'week',
            v_origem.inicio AT TIME ZONE 'America/Sao_Paulo'
          )
        )
        OR (
          p_escopo = 'serie_mes'
          AND (a.inicio AT TIME ZONE 'America/Sao_Paulo')::date <= (
            date_trunc('month', v_origem.inicio AT TIME ZONE 'America/Sao_Paulo')
            + interval '1 month'
            - interval '1 day'
          )::date
        )
      )
    )
    ORDER BY a.inicio ASC
  LOOP
    v_novo_inicio := v_ag.inicio + v_delta;
    INSERT INTO _remarcar_targets (agendamento_id, novo_inicio)
    VALUES (v_ag.id, v_novo_inicio);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM _remarcar_targets) THEN
    RAISE EXCEPTION 'Nenhum agendamento elegível para remarcação';
  END IF;

  SELECT COUNT(*) INTO v_conflito
  FROM _remarcar_targets t
  JOIN public.agendamentos existente
    ON existente.fisioterapeuta_id = v_fisio_destino
   AND existente.status IN ('agendado', 'confirmado', 'indisponivel', 'ferias', 'horario_extra')
   AND existente.id NOT IN (SELECT agendamento_id FROM _remarcar_targets)
   AND tstzrange(
         existente.inicio,
         existente.inicio + make_interval(mins => existente.duracao_min),
         '[)'
       )
       && tstzrange(
         t.novo_inicio,
         t.novo_inicio + make_interval(mins => v_duracao),
         '[)'
       );

  IF v_conflito > 0 THEN
    RAISE EXCEPTION 'Horário indisponível — conflito com outro agendamento do fisioterapeuta';
  END IF;

  FOR v_ag IN
    SELECT a.*
    FROM public.agendamentos a
    JOIN _remarcar_targets t ON t.agendamento_id = a.id
    ORDER BY a.inicio ASC
  LOOP
    SELECT t.novo_inicio INTO v_novo_inicio
    FROM _remarcar_targets t
    WHERE t.agendamento_id = v_ag.id;

    INSERT INTO public.agendamentos (
      paciente_id,
      fisioterapeuta_id,
      inicio,
      duracao_min,
      servico,
      status,
      serie_id,
      remarcado_de_id,
      canal_origem
    ) VALUES (
      v_ag.paciente_id,
      v_fisio_destino,
      v_novo_inicio,
      v_duracao,
      v_ag.servico,
      'agendado',
      v_ag.serie_id,
      v_ag.id,
      'remanejamento'
    )
    RETURNING id INTO v_novo_id;

    UPDATE public.agendamentos
    SET status = 'remarcacao', remarcado_para_id = v_novo_id
    WHERE id = v_ag.id;

    INSERT INTO public.agendamento_historico (
      agendamento_id, acao, status_anterior, status_novo,
      inicio_anterior, inicio_novo, escopo, usuario_id
    ) VALUES
      (v_ag.id, 'remanejamento', v_ag.status::text, 'remarcacao', v_ag.inicio, v_novo_inicio, p_escopo, p_usuario_id),
      (v_novo_id, 'remanejamento', v_ag.status::text, 'agendado', v_ag.inicio, v_novo_inicio, p_escopo, p_usuario_id);

    IF v_ag.paciente_id IS NOT NULL THEN
      v_data_antiga := (v_ag.inicio AT TIME ZONE 'America/Sao_Paulo')::date;
      v_data_nova := (v_novo_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
      v_hora := (v_novo_inicio AT TIME ZONE 'America/Sao_Paulo')::time;

      IF v_data_antiga <> v_data_nova THEN
        INSERT INTO _move_plans (paciente_id, data_antiga, data_nova, hora, fisioterapeuta_id)
        VALUES (v_ag.paciente_id, v_data_antiga, v_data_nova, v_hora, v_fisio_destino)
        ON CONFLICT (paciente_id, data_antiga, data_nova) DO NOTHING;
      ELSE
        INSERT INTO _hora_updates (paciente_id, data, hora, fisioterapeuta_id)
        VALUES (v_ag.paciente_id, v_data_antiga, v_hora, v_fisio_destino)
        ON CONFLICT (paciente_id, data) DO UPDATE
        SET hora = EXCLUDED.hora, fisioterapeuta_id = EXCLUDED.fisioterapeuta_id;
      END IF;
    END IF;

    IF v_primeiro_novo_id IS NULL THEN
      v_primeiro_novo_id := v_novo_id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  FOR v_plan IN SELECT * FROM _move_plans LOOP
    SELECT s.sigla INTO v_sigla_origem
    FROM public.sessoes s
    WHERE s.paciente_id = v_plan.paciente_id
      AND s.data = v_plan.data_antiga
    ORDER BY s.created_at ASC
    LIMIT 1;

    IF v_sigla_origem IS NULL THEN
      CONTINUE;
    END IF;

    SELECT s.sigla INTO v_sigla_destino
    FROM public.sessoes s
    WHERE s.paciente_id = v_plan.paciente_id
      AND s.data = v_plan.data_nova
    ORDER BY s.created_at ASC
    LIMIT 1;

    IF v_sigla_destino IS NOT NULL THEN
      DELETE FROM public.sessoes
      WHERE paciente_id = v_plan.paciente_id
        AND data = v_plan.data_antiga;
      v_freq_perdida := v_freq_perdida + 1;
    ELSE
      UPDATE public.sessoes
      SET data = v_plan.data_nova,
          hora = COALESCE(v_plan.hora, hora),
          fisioterapeuta_id = COALESCE(v_plan.fisioterapeuta_id, fisioterapeuta_id)
      WHERE paciente_id = v_plan.paciente_id
        AND data = v_plan.data_antiga;
    END IF;
  END LOOP;

  FOR v_hora_plan IN SELECT * FROM _hora_updates LOOP
    UPDATE public.sessoes
    SET hora = COALESCE(v_hora_plan.hora, hora),
        fisioterapeuta_id = COALESCE(v_hora_plan.fisioterapeuta_id, fisioterapeuta_id)
    WHERE paciente_id = v_hora_plan.paciente_id
      AND data = v_hora_plan.data;
  END LOOP;

  RETURN jsonb_build_object(
    'count', v_count,
    'primeiro_novo_id', v_primeiro_novo_id,
    'frequencia_perdida_count', v_freq_perdida
  );
END;
$$;
