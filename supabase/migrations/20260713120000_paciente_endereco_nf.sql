-- Endereço do paciente (tomador particular na NFS-e).

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero_endereco text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge int;

COMMENT ON COLUMN public.pacientes.endereco IS 'Logradouro do tomador (NF particular)';
COMMENT ON COLUMN public.pacientes.codigo_municipio_ibge IS 'IBGE do municipio do tomador (ex.: 4314902 POA)';
