-- Adiciona modelo 'puc' aos relatórios de atendimento (4º template: Particular/Judicial/Convênio/PUC)
-- e cria bucket de storage para os PDFs reais gerados por gerar-relatorio-mensal.

ALTER TYPE public.modelo_relatorio ADD VALUE IF NOT EXISTS 'puc';

-- Template PUC reaproveita o mesmo layout/placeholders do Convencional (sem modelo próprio ainda)
INSERT INTO public.templates_versionados (codigo, tipo, modelo, versao, conteudo)
SELECT 'RQ.GPS.09.108', 'relatorio_atendimento', 'puc', 1,
  '{"placeholders": ["paciente_nome", "competencia", "evolucao_resumo"]}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.templates_versionados WHERE codigo = 'RQ.GPS.09.108'
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'relatorios-atendimento',
  'relatorios-atendimento',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "auth read relatorios atendimento pdf"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'relatorios-atendimento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "gst upload relatorios atendimento pdf"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'relatorios-atendimento'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'fisio')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "gst update relatorios atendimento pdf"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'relatorios-atendimento'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "gst delete relatorios atendimento pdf"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'relatorios-atendimento'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
