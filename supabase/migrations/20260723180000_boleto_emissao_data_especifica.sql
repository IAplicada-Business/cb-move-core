-- Emissão automática de boleto Cora no dia cadastrado no paciente (cron diário)

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS dia_emissao_boleto integer
    CHECK (dia_emissao_boleto IS NULL OR (dia_emissao_boleto >= 1 AND dia_emissao_boleto <= 28));

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS modo_emissao_boleto public.modo_emissao_nf NOT NULL DEFAULT 'automatico_pagamento';

COMMENT ON COLUMN public.pacientes.dia_emissao_boleto IS
  'Dia do mês (1-28) para gerar boleto Cora quando modo_emissao_boleto = data_especifica';
COMMENT ON COLUMN public.pacientes.modo_emissao_boleto IS
  'automatico_pagamento = emitir manualmente na tela Cobranças; data_especifica = cron no dia_emissao_boleto';

CREATE OR REPLACE FUNCTION public.processar_boleto_emissao_data_especifica(p_dia integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia integer := COALESCE(p_dia, EXTRACT(DAY FROM CURRENT_DATE)::integer);
  v_mes integer := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
  v_ano integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_ultimo_dia integer := EXTRACT(DAY FROM (date_trunc('month', make_date(v_ano, v_mes, 1)) + interval '1 month - 1 day'))::integer;
  v_pac record;
  v_cobranca_id uuid;
  v_venc date;
  v_criadas integer := 0;
  v_ja_com_boleto integer := 0;
  v_sem_doc integer := 0;
  v_cobranca_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'processar_boleto_emissao_data_especifica só pode ser chamada pelo service role';
  END IF;

  IF v_dia < 1 OR v_dia > 28 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dia inválido');
  END IF;

  FOR v_pac IN
    SELECT
      p.id,
      p.nome,
      p.tipo,
      p.dia_emissao_boleto,
      p.valor_mensal,
      p.valor_sessao,
      p.forma_pagamento_preferida,
      p.cpf,
      p.email
    FROM public.pacientes p
    WHERE p.ativo = true
      AND p.modo_emissao_boleto = 'data_especifica'
      AND p.dia_emissao_boleto = v_dia
      AND (
        p.forma_pagamento_preferida = 'boleto'
        OR (
          p.forma_pagamento_preferida IS NULL
          AND p.tipo IN ('particular', 'judicial')
        )
      )
  LOOP
    IF NULLIF(trim(v_pac.cpf), '') IS NULL OR NULLIF(trim(v_pac.email), '') IS NULL THEN
      v_sem_doc := v_sem_doc + 1;
      CONTINUE;
    END IF;

    v_venc := make_date(
      v_ano,
      v_mes,
      LEAST(GREATEST(v_pac.dia_emissao_boleto + 7, v_dia + 1), v_ultimo_dia)
    );

    SELECT c.id INTO v_cobranca_id
    FROM public.cobrancas c
    WHERE c.paciente_id = v_pac.id
      AND c.competencia_mes = v_mes
      AND c.competencia_ano = v_ano
      AND c.status <> 'cancelado'
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_cobranca_id IS NULL THEN
      INSERT INTO public.cobrancas (
        paciente_id,
        competencia_mes,
        competencia_ano,
        valor,
        tipo,
        status,
        servico,
        forma_pagamento,
        vencimento,
        observacoes
      )
      VALUES (
        v_pac.id,
        v_mes,
        v_ano,
        COALESCE(v_pac.valor_mensal, v_pac.valor_sessao, 0),
        v_pac.tipo,
        'pendente',
        'Mensalidade fisioterapia',
        'boleto',
        v_venc,
        'Gerada automaticamente (boleto data específica)'
      )
      RETURNING id INTO v_cobranca_id;
      v_criadas := v_criadas + 1;
    ELSE
      UPDATE public.cobrancas c
      SET
        forma_pagamento = COALESCE(c.forma_pagamento, 'boleto'),
        vencimento = COALESCE(c.vencimento, v_venc)
      WHERE c.id = v_cobranca_id
        AND (c.forma_pagamento IS NULL OR c.vencimento IS NULL);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.cobrancas c
      WHERE c.id = v_cobranca_id
        AND c.boleto_url IS NOT NULL
        AND trim(c.boleto_url) <> ''
        AND COALESCE(c.boleto_modo, 'automatico') = 'automatico'
    ) THEN
      v_ja_com_boleto := v_ja_com_boleto + 1;
      CONTINUE;
    END IF;

    v_cobranca_ids := array_append(v_cobranca_ids, v_cobranca_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'dia', v_dia,
    'mes', v_mes,
    'ano', v_ano,
    'cobrancas_criadas', v_criadas,
    'ja_com_boleto', v_ja_com_boleto,
    'ignoradas_sem_doc', v_sem_doc,
    'cobranca_ids', to_jsonb(v_cobranca_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.processar_boleto_emissao_data_especifica(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.processar_boleto_emissao_data_especifica(integer) TO service_role;

-- Cron diário (08:15 UTC-3 ≈ 11:15 UTC) — após NF data específica
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_cron_secret text;
BEGIN
  SELECT valor INTO v_cron_secret
  FROM public.integracao_config
  WHERE chave = 'CRON_SECRET';

  IF v_cron_secret IS NULL THEN
    RAISE NOTICE 'CRON_SECRET ausente — cron boleto-emissao-data-especifica não agendado';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'boleto-emissao-data-especifica') THEN
    PERFORM cron.unschedule('boleto-emissao-data-especifica');
  END IF;

  PERFORM cron.schedule(
    'boleto-emissao-data-especifica',
    '15 11 * * *',
    format(
      $job$
      SELECT net.http_post(
        url := 'https://%s.supabase.co/functions/v1/boleto-emissao-data-especifica',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
        body := '{}'::jsonb
      );
      $job$,
      'grlkbtnwvxorlfglyzid',
      v_cron_secret
    )
  );
END $$;
