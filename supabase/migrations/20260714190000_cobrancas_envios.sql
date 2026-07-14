-- Auditoria de envios de boleto (e-mail / WhatsApp via n8n)
CREATE TABLE IF NOT EXISTS public.cobrancas_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  canais text[] NOT NULL DEFAULT '{}',
  destinatarios text[] NOT NULL DEFAULT '{}',
  event_id text,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobrancas_envios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth select cobrancas_envios" ON public.cobrancas_envios
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "gst write cobrancas_envios" ON public.cobrancas_envios
    FOR INSERT TO authenticated WITH CHECK (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestao')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_envios_event_id
  ON public.cobrancas_envios (event_id)
  WHERE event_id IS NOT NULL;

COMMENT ON TABLE public.cobrancas_envios IS
  'Registro de envios de boleto ao paciente (n8n). event_id evita duplicata.';
