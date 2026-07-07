-- Rode no SQL Editor do Supabase (não precisa de permissão de Edge Secrets).
-- Substitua <WEBHOOK_SECRET> pelo Value da credencial n8n "CB MOVE NF Webhook Secret".

INSERT INTO public.integracao_config (chave, valor)
VALUES
  ('N8N_WEBHOOK_NF_EMAIL', 'https://iaplicada.app.n8n.cloud/webhook/cbmove-nf-email'),
  ('N8N_WEBHOOK_SECRET', '<WEBHOOK_SECRET>')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, atualizado_em = now();

SELECT chave, left(valor, 12) || '…' AS valor_mascarado, atualizado_em
FROM public.integracao_config
WHERE chave LIKE 'N8N_%'
ORDER BY chave;
