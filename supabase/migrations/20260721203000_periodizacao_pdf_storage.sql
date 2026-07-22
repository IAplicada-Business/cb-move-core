-- Periodização no prontuário: importação de PDF (substitui link do Google Drive)

ALTER TABLE public.pacientes
  RENAME COLUMN periodizacao_drive_url TO periodizacao_pdf_url;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'periodizacao-pdf',
  'periodizacao-pdf',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "auth read periodizacao pdf"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'periodizacao-pdf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prontuario upload periodizacao pdf"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'periodizacao-pdf'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'fisio')
      OR public.has_role(auth.uid(), 'membro')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prontuario update periodizacao pdf"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'periodizacao-pdf'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'fisio')
      OR public.has_role(auth.uid(), 'membro')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "gestao delete periodizacao pdf"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'periodizacao-pdf'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
