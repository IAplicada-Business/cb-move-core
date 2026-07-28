-- Inclui cobranças retroativas na fila de emissão de NF (antes estavam excluídas).
DROP FUNCTION IF EXISTS public.cobrancas_sem_nf(int, int);

CREATE OR REPLACE FUNCTION public.cobrancas_sem_nf(p_mes int, p_ano int)
RETURNS TABLE (
  cobranca_id uuid,
  paciente_id uuid,
  paciente_nome text,
  paciente_cpf text,
  paciente_telefone text,
  tipo public.paciente_tipo,
  valor numeric,
  competencia_mes int,
  competencia_ano int,
  destinatario_nome text,
  destinatario_documento text,
  status public.cobranca_status
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    NULL;
  ELSIF NOT public.has_finance_access() THEN
    RAISE EXCEPTION 'Sem permissao financeira';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.paciente_id,
    p.nome,
    p.cpf,
    p.telefone,
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
    AND c.status IN (
      'pago',
      'pendente',
      'aguardando_convenio',
      'aguardando_alvara',
      'vencido',
      'atrasado',
      'regularizar_retroativa'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.cobranca_id = c.id AND nf.status <> 'cancelada'
    )
  ORDER BY p.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.cobrancas_sem_nf(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cobrancas_sem_nf(int, int) TO authenticated, service_role;
