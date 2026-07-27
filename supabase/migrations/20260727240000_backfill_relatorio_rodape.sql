-- B5: preencher num_sessoes/valor_total ausentes
UPDATE public.relatorios_atendimento r
SET num_sessoes = (
  SELECT COUNT(*)::int FROM public.relatorio_atendimento_linhas l WHERE l.relatorio_id = r.id
)
WHERE r.num_sessoes IS NULL
  AND EXISTS (SELECT 1 FROM public.relatorio_atendimento_linhas l WHERE l.relatorio_id = r.id);

UPDATE public.relatorios_atendimento r
SET valor_total = ROUND(r.valor_sessao * r.num_sessoes, 2)
WHERE r.valor_total IS NULL
  AND r.valor_sessao IS NOT NULL
  AND r.num_sessoes IS NOT NULL;
