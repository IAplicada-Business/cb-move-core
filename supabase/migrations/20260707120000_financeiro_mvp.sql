-- Financeiro MVP: RPCs, schema extensions
-- 2026-07-07

ALTER TABLE public.convenios
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS email_nf text;

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS competencia_mes int,
  ADD COLUMN IF NOT EXISTS competencia_ano int,
  ADD COLUMN IF NOT EXISTS fiscal_provider text;

ALTER TABLE public.notas_fiscais_envios
  ADD COLUMN IF NOT EXISTS event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nf_envios_event_id
  ON public.notas_fiscais_envios (event_id)
  WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.financeiro_kpis(p_mes int, p_ano int)
RETURNS TABLE (
  total numeric,
  pago numeric,
  pendente numeric,
  vencido numeric,
  qtd_total bigint,
  qtd_pago bigint,
  qtd_pendente bigint,
  qtd_vencido bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(c.valor), 0) AS total,
    COALESCE(SUM(c.valor) FILTER (WHERE c.status = 'pago'), 0) AS pago,
    COALESCE(SUM(c.valor) FILTER (WHERE c.status IN ('pendente', 'aguardando_convenio', 'aguardando_alvara')), 0) AS pendente,
    COALESCE(SUM(c.valor) FILTER (WHERE c.status IN ('vencido', 'atrasado')), 0) AS vencido,
    COUNT(*) AS qtd_total,
    COUNT(*) FILTER (WHERE c.status = 'pago') AS qtd_pago,
    COUNT(*) FILTER (WHERE c.status IN ('pendente', 'aguardando_convenio', 'aguardando_alvara')) AS qtd_pendente,
    COUNT(*) FILTER (WHERE c.status IN ('vencido', 'atrasado')) AS qtd_vencido
  FROM public.cobrancas c
  WHERE c.competencia_mes = p_mes
    AND c.competencia_ano = p_ano
    AND c.status <> 'cancelado';
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_kpis(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_kpis_por_tipo(p_mes int, p_ano int)
RETURNS TABLE (
  tipo public.paciente_tipo,
  valor numeric,
  pacientes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.tipo,
    COALESCE(SUM(c.valor), 0) AS valor,
    COUNT(DISTINCT c.paciente_id) AS pacientes
  FROM public.cobrancas c
  WHERE c.competencia_mes = p_mes
    AND c.competencia_ano = p_ano
    AND c.status <> 'cancelado'
  GROUP BY c.tipo
  ORDER BY c.tipo;
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_kpis_por_tipo(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.relatorio_receita_convenio(p_mes int, p_ano int)
RETURNS TABLE (
  convenio text,
  pacientes bigint,
  sessoes bigint,
  nfs_emitidas bigint,
  faturado numeric,
  recebido numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cob AS (
    SELECT
      c.id,
      c.paciente_id,
      c.valor,
      c.status,
      c.qtd_sessoes,
      COALESCE(conv.nome, initcap(c.tipo::text)) AS convenio_nome
    FROM public.cobrancas c
    JOIN public.pacientes p ON p.id = c.paciente_id
    LEFT JOIN public.convenios conv ON conv.id = p.convenio_id
    WHERE c.competencia_mes = p_mes
      AND c.competencia_ano = p_ano
      AND c.status <> 'cancelado'
  ),
  nf_counts AS (
    SELECT
      COALESCE(conv.nome, initcap(nf.tipo::text)) AS convenio_nome,
      COUNT(*) AS nfs_emitidas
    FROM public.notas_fiscais nf
    JOIN public.pacientes p ON p.id = nf.paciente_id
    LEFT JOIN public.convenios conv ON conv.id = p.convenio_id
    WHERE nf.status = 'emitida'
      AND nf.competencia_mes = p_mes
      AND nf.competencia_ano = p_ano
    GROUP BY 1
  )
  SELECT
    cob.convenio_nome AS convenio,
    COUNT(DISTINCT cob.paciente_id) AS pacientes,
    COALESCE(SUM(cob.qtd_sessoes), 0) AS sessoes,
    COALESCE(nf.nfs_emitidas, 0) AS nfs_emitidas,
    COALESCE(SUM(cob.valor), 0) AS faturado,
    COALESCE(SUM(cob.valor) FILTER (WHERE cob.status = 'pago'), 0) AS recebido
  FROM cob
  LEFT JOIN nf_counts nf ON nf.convenio_nome = cob.convenio_nome
  GROUP BY cob.convenio_nome, nf.nfs_emitidas
  ORDER BY faturado DESC;
$$;

GRANT EXECUTE ON FUNCTION public.relatorio_receita_convenio(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolver_destinatario_nf(p_cobranca_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cob record;
  v_conv record;
  v_result jsonb;
BEGIN
  SELECT c.*, p.nome AS paciente_nome, p.cpf AS paciente_cpf,
         p.numero_processo, p.convenio_id, p.tipo AS paciente_tipo
  INTO v_cob
  FROM public.cobrancas c
  JOIN public.pacientes p ON p.id = c.paciente_id
  WHERE c.id = p_cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobrança não encontrada';
  END IF;

  IF v_cob.convenio_id IS NOT NULL THEN
    SELECT * INTO v_conv FROM public.convenios WHERE id = v_cob.convenio_id;
  END IF;

  v_result := jsonb_build_object(
    'cobranca_id', v_cob.id,
    'paciente_id', v_cob.paciente_id,
    'paciente_nome', v_cob.paciente_nome,
    'tipo', v_cob.tipo,
    'valor', v_cob.valor,
    'competencia_mes', v_cob.competencia_mes,
    'competencia_ano', v_cob.competencia_ano
  );

  CASE v_cob.tipo
    WHEN 'particular' THEN
      v_result := v_result || jsonb_build_object(
        'destinatario_nome', v_cob.paciente_nome,
        'destinatario_documento', v_cob.paciente_cpf,
        'template_codigo', 'RQ.GPS.07.001'
      );
    WHEN 'convenio' THEN
      v_result := v_result || jsonb_build_object(
        'destinatario_nome', COALESCE(v_conv.razao_social, v_conv.nome, 'Convênio'),
        'destinatario_documento', v_conv.cnpj,
        'template_codigo', 'RQ.GPS.07.002'
      );
    WHEN 'judicial' THEN
      v_result := v_result || jsonb_build_object(
        'destinatario_nome', COALESCE(v_conv.razao_social, v_conv.nome, 'Bradesco Seguros'),
        'destinatario_documento', v_conv.cnpj,
        'corpo_paciente_nome', v_cob.paciente_nome,
        'corpo_paciente_cpf', v_cob.paciente_cpf,
        'corpo_numero_processo', v_cob.numero_processo,
        'corpo_total_sessoes', v_cob.qtd_sessoes,
        'template_codigo', 'RQ.GPS.07.003'
      );
    WHEN 'puc' THEN
      v_result := v_result || jsonb_build_object(
        'destinatario_nome', COALESCE(v_conv.razao_social, v_conv.nome, 'PUCRS'),
        'destinatario_documento', v_conv.cnpj,
        'template_codigo', 'RQ.GPS.07.002'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'destinatario_nome', v_cob.paciente_nome,
        'destinatario_documento', v_cob.paciente_cpf
      );
  END CASE;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_destinatario_nf(uuid) TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.criar_nf_de_cobranca(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cobrancas_sem_nf(p_mes int, p_ano int)
RETURNS TABLE (
  cobranca_id uuid,
  paciente_id uuid,
  paciente_nome text,
  tipo public.paciente_tipo,
  valor numeric,
  competencia_mes int,
  competencia_ano int,
  destinatario_nome text,
  destinatario_documento text,
  status public.cobranca_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.paciente_id,
    p.nome,
    c.tipo,
    c.valor,
    c.competencia_mes,
    c.competencia_ano,
    (public.resolver_destinatario_nf(c.id)->>'destinatario_nome'),
    (public.resolver_destinatario_nf(c.id)->>'destinatario_documento'),
    c.status
  FROM public.cobrancas c
  JOIN public.pacientes p ON p.id = c.paciente_id
  WHERE c.competencia_mes = p_mes
    AND c.competencia_ano = p_ano
    AND c.status IN ('pago', 'pendente', 'aguardando_convenio', 'aguardando_alvara')
    AND NOT EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.cobranca_id = c.id AND nf.status <> 'cancelada'
    )
  ORDER BY p.nome;
$$;

GRANT EXECUTE ON FUNCTION public.cobrancas_sem_nf(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_cobrancas_vencidas()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.cobrancas
    SET status = 'vencido'
    WHERE status IN ('pendente', 'aguardando_convenio', 'aguardando_alvara')
      AND vencimento IS NOT NULL
      AND vencimento < CURRENT_DATE
    RETURNING id
  )
  SELECT COUNT(*)::bigint FROM updated;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_cobrancas_vencidas() TO authenticated, service_role;
