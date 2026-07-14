-- Integração Direta Cora (mTLS) — substitua os placeholders antes de rodar.
-- Preferível: python scripts/apply-integracao-cora.py (lê os .pem do disco).
--
-- SQL Editor: https://supabase.com/dashboard/project/grlkbtnwvxorlfglyzid/sql/new

INSERT INTO public.integracao_config (chave, valor)
VALUES
  ('CORA_CLIENT_ID', '<client-id do mesmo pacote do zip — NÃO usar placeholder>'),
  ('CORA_CERTIFICATE', '<conteúdo completo do certificate.pem>'),
  ('CORA_PRIVATE_KEY', '<conteúdo completo do private-key.key>'),
  ('CORA_API_BASE', 'https://matls-clients.api.stage.cora.com.br')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, atualizado_em = now();

SELECT chave,
  CASE
    WHEN chave IN ('CORA_CERTIFICATE', 'CORA_PRIVATE_KEY') THEN left(valor, 28) || '…'
    ELSE valor
  END AS valor_mascarado,
  atualizado_em
FROM public.integracao_config
WHERE chave LIKE 'CORA_%'
ORDER BY chave;
