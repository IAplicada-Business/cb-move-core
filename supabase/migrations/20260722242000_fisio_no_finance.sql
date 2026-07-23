-- Fisio clínico não acessa dados financeiros (tabelas + RPCs).

CREATE OR REPLACE FUNCTION public.staff_can_view_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.staff_can_manage_pacientes();
$$;

GRANT EXECUTE ON FUNCTION public.staff_can_view_finance() TO authenticated;

DROP POLICY IF EXISTS "auth select cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "scoped select cobrancas" ON public.cobrancas;
CREATE POLICY "scoped select cobrancas"
  ON public.cobrancas FOR SELECT TO authenticated
  USING (public.staff_can_view_finance());

DROP POLICY IF EXISTS "auth select nf" ON public.notas_fiscais;
DROP POLICY IF EXISTS "scoped select nf" ON public.notas_fiscais;
CREATE POLICY "scoped select nf"
  ON public.notas_fiscais FOR SELECT TO authenticated
  USING (public.staff_can_view_finance());

DROP POLICY IF EXISTS "auth select nf_envios" ON public.notas_fiscais_envios;
DROP POLICY IF EXISTS "scoped select nf_envios" ON public.notas_fiscais_envios;
CREATE POLICY "scoped select nf_envios"
  ON public.notas_fiscais_envios FOR SELECT TO authenticated
  USING (
    public.staff_can_view_finance()
    AND EXISTS (
      SELECT 1
      FROM public.notas_fiscais nf
      WHERE nf.id = nota_fiscal_id
    )
  );

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_finance() THEN
    RETURN;
  END IF;

  RETURN QUERY
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
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_kpis_por_tipo(p_mes int, p_ano int)
RETURNS TABLE (
  tipo public.paciente_tipo,
  valor numeric,
  pacientes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_finance() THEN
    RETURN;
  END IF;

  RETURN QUERY
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
END;
$$;

CREATE OR REPLACE FUNCTION public.relatorio_receita_convenio(p_mes int, p_ano int)
RETURNS TABLE (
  convenio text,
  pacientes bigint,
  sessoes bigint,
  nfs_emitidas bigint,
  faturado numeric,
  recebido numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_finance() THEN
    RETURN;
  END IF;

  RETURN QUERY
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
END;
$$;
