-- Expõe CPF/telefone do paciente na fila "A emitir" (UI + elegibilidade)

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND c.status IN ('pago', 'pendente', 'aguardando_convenio', 'aguardando_alvara', 'vencido', 'atrasado')
    AND NOT EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.cobranca_id = c.id AND nf.status <> 'cancelada'
    )
  ORDER BY p.nome;
$$;
