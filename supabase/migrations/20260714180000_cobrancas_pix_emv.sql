-- PIX Copia e Cola retornado pela Cora (v2/invoices → pix.emv)
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS pix_emv text;
