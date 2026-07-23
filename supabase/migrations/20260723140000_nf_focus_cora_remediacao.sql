-- NF Focus/Cora: RPC security, data_especifica retorna nf_ids, lockdown marcar_cobranca_paga

CREATE OR REPLACE FUNCTION public.assert_finance_or_service_role()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (edge/cron): auth.uid() IS NULL
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'recepcao')
    OR public.has_role(auth.uid(), 'membro') THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Sem permissão financeira';
END;
$$;

REVOKE ALL ON FUNCTION public.assert_finance_or_service_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_finance_or_service_role() TO authenticated, service_role;

-- criar_nf_de_cobranca: só financeiro ou service role
CREATE OR REPLACE FUNCTION public.criar_nf_de_cobranca(p_cobranca_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dest jsonb;
  v_nf_id uuid;
BEGIN
  PERFORM public.assert_finance_or_service_role();

  IF EXISTS (
    SELECT 1 FROM public.notas_fiscais WHERE cobranca_id = p_cobranca_id AND status <> 'cancelada'
  ) THEN
    RAISE EXCEPTION 'Já existe NF vinculada a esta cobrança';
  END IF;

  v_dest := public.resolver_destinatario_nf(p_cobranca_id);

  INSERT INTO public.notas_fiscais (
    cobranca_id, paciente_id, tipo, valor,
    destinatario_nome, destinatario_documento,
    corpo_paciente_nome, corpo_paciente_cpf, corpo_numero_processo, corpo_total_sessoes,
    competencia_mes, competencia_ano, status
  ) VALUES (
    p_cobranca_id,
    (v_dest->>'paciente_id')::uuid,
    (v_dest->>'tipo')::public.paciente_tipo,
    (v_dest->>'valor')::numeric,
    v_dest->>'destinatario_nome',
    v_dest->>'destinatario_documento',
    v_dest->>'corpo_paciente_nome',
    v_dest->>'corpo_paciente_cpf',
    v_dest->>'corpo_numero_processo',
    (v_dest->>'corpo_total_sessoes')::int,
    (v_dest->>'competencia_mes')::int,
    (v_dest->>'competencia_ano')::int,
    'pendente'
  )
  RETURNING id INTO v_nf_id;

  RETURN v_nf_id;
END;
$$;

-- marcar_cobranca_paga_cora: apenas service role (edge functions)
CREATE OR REPLACE FUNCTION public.marcar_cobranca_paga_cora(
  p_cobranca_id uuid,
  p_pago_em date,
  p_payload jsonb DEFAULT NULL
)
RETURNS SETOF public.cobrancas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'marcar_cobranca_paga_cora só pode ser chamada pelo service role';
  END IF;

  RETURN QUERY
    UPDATE public.cobrancas
    SET status = 'pago',
        pago_em = COALESCE(p_pago_em, pago_em, CURRENT_DATE)
    WHERE id = p_cobranca_id
      AND status <> 'pago'
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_cobranca_paga_cora(uuid, date, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_cobranca_paga_cora(uuid, date, jsonb) TO service_role;

-- processar_nf_emissao_data_especifica: retorna nf_ids para emit-nf no cron
CREATE OR REPLACE FUNCTION public.processar_nf_emissao_data_especifica(p_dia integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia integer := COALESCE(p_dia, EXTRACT(DAY FROM CURRENT_DATE)::integer);
  v_mes integer := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
  v_ano integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_pac record;
  v_cobranca_id uuid;
  v_nf_id uuid;
  v_criadas integer := 0;
  v_emitidas integer := 0;
  v_nf_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'processar_nf_emissao_data_especifica só pode ser chamada pelo service role';
  END IF;

  IF v_dia < 1 OR v_dia > 28 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dia inválido');
  END IF;

  FOR v_pac IN
    SELECT p.id, p.nome, p.valor_mensal, p.valor_sessao, p.regime_cobranca
    FROM public.pacientes p
    WHERE p.ativo = true
      AND p.modo_emissao_nf = 'data_especifica'
      AND p.dia_emissao_nf = v_dia
  LOOP
    SELECT c.id INTO v_cobranca_id
    FROM public.cobrancas c
    WHERE c.paciente_id = v_pac.id
      AND c.competencia_mes = v_mes
      AND c.competencia_ano = v_ano
      AND c.status NOT IN ('cancelado')
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_cobranca_id IS NULL THEN
      INSERT INTO public.cobrancas (
        paciente_id, competencia_mes, competencia_ano, valor,
        status, servico, observacoes
      )
      VALUES (
        v_pac.id, v_mes, v_ano,
        COALESCE(v_pac.valor_mensal, v_pac.valor_sessao, 0),
        'pendente',
        'Mensalidade fisioterapia',
        'Gerada automaticamente (NF data específica)'
      )
      RETURNING id INTO v_cobranca_id;
      v_criadas := v_criadas + 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.notas_fiscais nf WHERE nf.cobranca_id = v_cobranca_id
    ) THEN
      v_nf_id := public.criar_nf_de_cobranca(v_cobranca_id);
      v_emitidas := v_emitidas + 1;
      v_nf_ids := array_append(v_nf_ids, v_nf_id);
    ELSE
      SELECT nf.id INTO v_nf_id
      FROM public.notas_fiscais nf
      WHERE nf.cobranca_id = v_cobranca_id
        AND nf.status IN ('pendente', 'erro')
      ORDER BY nf.created_at DESC
      LIMIT 1;

      IF v_nf_id IS NOT NULL THEN
        v_nf_ids := array_append(v_nf_ids, v_nf_id);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'dia', v_dia,
    'mes', v_mes,
    'ano', v_ano,
    'cobrancas_criadas', v_criadas,
    'nfs_criadas', v_emitidas,
    'nf_ids', to_jsonb(v_nf_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.processar_nf_emissao_data_especifica(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.processar_nf_emissao_data_especifica(integer) TO service_role;
