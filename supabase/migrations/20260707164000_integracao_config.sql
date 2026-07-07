-- Fallback quando Edge Function Secrets não estão disponíveis no dashboard.
-- Apenas service_role (Edge Functions) acessa; sem policies para authenticated/anon.

CREATE TABLE IF NOT EXISTS public.integracao_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integracao_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.integracao_config FROM anon, authenticated;
GRANT ALL ON public.integracao_config TO service_role;

COMMENT ON TABLE public.integracao_config IS
  'Config de integrações externas (n8n, Cora, etc.). Usado pelas Edge Functions quando secrets do dashboard não estão acessíveis.';
