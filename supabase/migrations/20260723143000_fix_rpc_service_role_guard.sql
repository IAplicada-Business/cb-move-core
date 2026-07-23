-- Corrige guards de RPC: auth.uid() IS NULL inclui anon key — usar auth.role() = service_role

CREATE OR REPLACE FUNCTION public.assert_finance_or_service_role()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sem permissão financeira';
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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
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
