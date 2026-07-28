-- Permite registrar pagamentos manuais (depósito/PIX/alvará) no log de eventos.
ALTER TABLE public.cobrancas_pagamentos_eventos
  DROP CONSTRAINT IF EXISTS cobrancas_pagamentos_eventos_origem_check;

ALTER TABLE public.cobrancas_pagamentos_eventos
  ADD CONSTRAINT cobrancas_pagamentos_eventos_origem_check
  CHECK (origem IN ('polling', 'webhook', 'manual'));

COMMENT ON COLUMN public.cobrancas_pagamentos_eventos.origem IS
  'polling/webhook = Cora; manual = baixa registrada pela equipe financeira.';
