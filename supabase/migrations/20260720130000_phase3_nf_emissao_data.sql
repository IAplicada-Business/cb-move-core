-- Fase 3.3: emissão de NF em data específica relativa ao cadastro

DO $$ BEGIN
  CREATE TYPE public.modo_emissao_nf AS ENUM ('automatico_pagamento', 'data_especifica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS dia_emissao_nf integer
    CHECK (dia_emissao_nf IS NULL OR (dia_emissao_nf >= 1 AND dia_emissao_nf <= 28));

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS modo_emissao_nf public.modo_emissao_nf NOT NULL DEFAULT 'automatico_pagamento';

COMMENT ON COLUMN public.pacientes.dia_emissao_nf IS 'Dia do mês (1-28) para emissão automática de NF quando modo_emissao_nf = data_especifica';
COMMENT ON COLUMN public.pacientes.modo_emissao_nf IS 'automatico_pagamento = fluxo Cora/pós-pagamento; data_especifica = cron mensal no dia_emissao_nf';

-- RPC: processa emissão NF por data para pacientes em modo data_especifica (chamada pelo cron)
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
BEGIN
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
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'dia', v_dia,
    'mes', v_mes,
    'ano', v_ano,
    'cobrancas_criadas', v_criadas,
    'nfs_criadas', v_emitidas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.processar_nf_emissao_data_especifica(integer) TO service_role;
