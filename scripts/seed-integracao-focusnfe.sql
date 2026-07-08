-- Rode no SQL Editor do Supabase (service_role / owner).
-- NÃO commite tokens reais no repositório.
--
-- O login do painel (email/senha) NÃO é o token da API.
-- Obtenha em: Painel API → Tokens → Token de Homologação (testes)
--              ou Token de Produção (notas válidas).

INSERT INTO public.integracao_config (chave, valor)
VALUES
  ('FOCUSNFE_TOKEN', '<TOKEN_HOMOLOGACAO_OU_PRODUCAO>'),
  ('FOCUSNFE_AMBIENTE', 'homologacao'),
  ('FOCUSNFE_CNPJ_PRESTADOR', '<CNPJ_CB_MOVE_SEM_PONTUACAO>'),
  ('FOCUSNFE_INSCRICAO_MUNICIPAL', '<IM_OPCIONAL>'),
  ('FOCUSNFE_CODIGO_TRIBUTACAO', '040802'),
  ('FOCUSNFE_CODIGO_NBS', '123019200'),
  ('FOCUSNFE_SIMPLES_NACIONAL', '1')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, atualizado_em = now();

SELECT chave,
  CASE
    WHEN chave LIKE '%TOKEN%' THEN left(valor, 8) || '…'
    ELSE valor
  END AS valor_mascarado,
  atualizado_em
FROM public.integracao_config
WHERE chave LIKE 'FOCUSNFE_%'
ORDER BY chave;
