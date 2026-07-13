-- Rode no SQL Editor do Supabase (service_role / owner).
-- NÃO commite tokens reais no repositório.
--
-- O login do painel (email/senha) NÃO é o token da API.
-- Substitua:
--   <TOKEN_EMPRESA_HOMOLOG> — token da empresa em Empresas → Tokens → Homologação
--   (NÃO use o token revenda da conta).

INSERT INTO public.integracao_config (chave, valor)
VALUES
  ('FOCUSNFE_TOKEN', '<TOKEN_HOMOLOGACAO_OU_PRODUCAO>'),
  ('FOCUSNFE_AMBIENTE', 'homologacao'),
  ('FOCUSNFE_CNPJ_PRESTADOR', '<CNPJ_CB_MOVE_SEM_PONTUACAO>'),
  -- POA no CNC NFS-e: NÃO enviar IM (Focus E0120 se informado).
  -- ('FOCUSNFE_INSCRICAO_MUNICIPAL', '...'),
  ('FOCUSNFE_CODIGO_TRIBUTACAO', '040802'),
  ('FOCUSNFE_CODIGO_NBS', '123019200'),
  ('FOCUSNFE_SIMPLES_NACIONAL', '3'),  -- 1=não optante, 2=MEI, 3=ME/EPP
  ('FOCUSNFE_REGIME_TRIBUTARIO_SN', '1'),  -- 1=fed+mun SN (obrigatório ME/EPP)
  ('FOCUSNFE_PERCENTUAL_TRIBUTOS_SN', '6')  -- pTotTribSN % — confirmar com Diego
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, atualizado_em = now();

-- Garante que IM não fique residual de seeds antigos (POA rejeita).
DELETE FROM public.integracao_config
WHERE chave = 'FOCUSNFE_INSCRICAO_MUNICIPAL';

SELECT chave,
  CASE
    WHEN chave LIKE '%TOKEN%' THEN left(valor, 8) || '…'
    ELSE valor
  END AS valor_mascarado,
  atualizado_em
FROM public.integracao_config
WHERE chave LIKE 'FOCUSNFE_%'
ORDER BY chave;
