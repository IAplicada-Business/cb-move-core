-- Fase 2.6: Parcelamento de cobranças (depósito/PIX/alvará recebidos fora do fluxo
-- de boleto Cora) e ampliação da lista "a emitir" de NF para não depender do
-- status de pagamento (emitir NF antes de dar baixa na cobrança).

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS parcelamento_grupo_id uuid,
  ADD COLUMN IF NOT EXISTS parcela_numero int,
  ADD COLUMN IF NOT EXISTS parcela_total int;

COMMENT ON COLUMN public.cobrancas.parcelamento_grupo_id IS
  'Agrupa cobranças geradas a partir de um parcelamento (mesmo valor total dividido em N meses futuros)';
COMMENT ON COLUMN public.cobrancas.parcela_numero IS 'Número desta parcela dentro do grupo (1-based)';
COMMENT ON COLUMN public.cobrancas.parcela_total IS 'Total de parcelas do grupo';

CREATE INDEX IF NOT EXISTS idx_cobrancas_parcelamento_grupo_id
  ON public.cobrancas (parcelamento_grupo_id)
  WHERE parcelamento_grupo_id IS NOT NULL;

-- Amplia "a emitir": NF pode ser emitida independentemente do status de pagamento
-- (depósito/PIX/alvará muitas vezes só são conciliados depois da NF). Antes só
-- entravam pago/pendente/aguardando_*; agora inclui vencido/atrasado também.
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
    AND c.status IN ('pago', 'pendente', 'aguardando_convenio', 'aguardando_alvara', 'vencido', 'atrasado')
    AND NOT EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.cobranca_id = c.id AND nf.status <> 'cancelada'
    )
  ORDER BY p.nome;
$$;

GRANT EXECUTE ON FUNCTION public.cobrancas_sem_nf(int, int) TO authenticated;
