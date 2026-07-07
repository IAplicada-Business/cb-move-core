-- Migration: adiciona modelo_relatorio_preferido em pacientes
-- Corresponde à REGRA 3 do import: SHAREPOINT = modelo de relatório, não forma de pagamento
-- Tipo modelo_relatorio já criado em 20260623120000_schema_completo_prompt_1a.sql

DO $$ BEGIN
  CREATE TYPE public.modelo_relatorio AS ENUM (
    'convencional',
    'sharepoint',
    'unimed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS modelo_relatorio_preferido public.modelo_relatorio DEFAULT 'convencional';
