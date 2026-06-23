-- Migration: adiciona modelo_relatorio_preferido em pacientes
-- Corresponde à REGRA 3 do import: SHAREPOINT = modelo de relatório, não forma de pagamento

CREATE TYPE public.modelo_relatorio AS ENUM (
  'convencional',
  'sharepoint',
  'unimed'
);

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS modelo_relatorio_preferido public.modelo_relatorio DEFAULT 'convencional';
