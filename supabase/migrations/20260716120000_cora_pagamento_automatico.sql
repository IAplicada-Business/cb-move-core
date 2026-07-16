-- Automação NF pós-pagamento Cora: fundação de dados
-- 2026-07-16

-- =========== boleto_modo ===========
-- Distingue boletos emitidos automaticamente via API Cora (elegíveis à automação)
-- de boletos cadastrados manualmente (nunca entram na automação, mesmo com um
-- cora_invoice_id colado à mão — ver pergunta 5/8 em docs/perguntas_cora_nf_automatica.md).
DO $$ BEGIN
  CREATE TYPE public.boleto_modo AS ENUM ('automatico', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS boleto_modo public.boleto_modo NOT NULL DEFAULT 'manual';

UPDATE public.cobrancas
SET boleto_modo = 'automatico'
WHERE cora_invoice_id IS NOT NULL
  AND boleto_modo <> 'automatico';

COMMENT ON COLUMN public.cobrancas.boleto_modo IS
  'automatico = boleto criado via API Cora (emit-boleto-cora), elegível à automação de NF pós-pagamento. manual = boleto/link cadastrado à mão, nunca entra na automação.';

-- =========== cobrancas_pagamentos_eventos ===========
-- Auditoria da sincronização de pagamentos Cora (polling e webhook) + ledger de
-- deduplicação de entregas de webhook via webhook_event_id.
CREATE TABLE IF NOT EXISTS public.cobrancas_pagamentos_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT 'polling' CHECK (origem IN ('polling', 'webhook')),
  webhook_event_id text,
  cora_invoice_id text,
  status_cora_anterior text,
  status_cora_novo text,
  marcou_pago boolean NOT NULL DEFAULT false,
  nf_criada boolean NOT NULL DEFAULT false,
  nf_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  emit_nf_disparado boolean NOT NULL DEFAULT false,
  erro text,
  payload jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobrancas_pagamentos_eventos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select cobrancas_pagamentos_eventos" ON public.cobrancas_pagamentos_eventos
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_pagamentos_eventos_webhook_event_id
  ON public.cobrancas_pagamentos_eventos (webhook_event_id)
  WHERE webhook_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cobrancas_pagamentos_eventos_cobranca_id
  ON public.cobrancas_pagamentos_eventos (cobranca_id);

COMMENT ON TABLE public.cobrancas_pagamentos_eventos IS
  'Log de sincronização de pagamentos Cora -> NF automática (polling/webhook) e ledger de dedup de webhook_event_id.';

-- =========== RPC marcar_cobranca_paga_cora ===========
-- Marca a cobrança como paga de forma idempotente (só muda se ainda não estiver
-- 'pago'). p_payload é aceito para o chamador anexar o payload cru do GET
-- /v2/invoices/{id} no log de evento gravado em seguida por _shared/cora-payment-sync.ts.
CREATE OR REPLACE FUNCTION public.marcar_cobranca_paga_cora(
  p_cobranca_id uuid,
  p_pago_em date,
  p_payload jsonb DEFAULT NULL
)
RETURNS SETOF public.cobrancas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    UPDATE public.cobrancas
    SET status = 'pago',
        pago_em = COALESCE(p_pago_em, pago_em, CURRENT_DATE)
    WHERE id = p_cobranca_id
      AND status <> 'pago'
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION public.marcar_cobranca_paga_cora(uuid, date, jsonb) IS
  'Idempotente: só atualiza e retorna a linha se a cobrança ainda não estava paga. p_payload não é persistido aqui (fica no log de cobrancas_pagamentos_eventos).';

GRANT EXECUTE ON FUNCTION public.marcar_cobranca_paga_cora(uuid, date, jsonb) TO authenticated, service_role;
