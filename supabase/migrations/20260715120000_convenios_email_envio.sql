-- Correção 2c: separar e-mail do TOMADOR (na NF) do e-mail de ENVIO (n8n).
-- email_nf  = e-mail que vai na NFS-e como e-mail do tomador (ex.: Bradesco = liminarprestador@).
-- email_envio = caixa para onde a documentação/NF é enviada (ex.: Bradesco liminar = logjur@).
-- Quando email_envio for nulo, o envio usa email_nf como fallback.

ALTER TABLE public.convenios
  ADD COLUMN IF NOT EXISTS email_envio text;

COMMENT ON COLUMN public.convenios.email_envio IS
  'Destino do envio da NF (n8n). Difere de email_nf (tomador na NFS-e). Fallback: email_nf.';

-- Bradesco Seguros (liminar judicial): restaura o e-mail do tomador conforme a NF real
-- e define a caixa Logjur como destino de envio (Material_Apoio_Liminar_Judicial_Bradesco.pdf).
UPDATE public.convenios
SET email_nf = 'liminarprestador@bradescoseguros.com.br',
    email_envio = 'logjur@bradescoseguros.com.br'
WHERE nome ILIKE '%bradesco%';
