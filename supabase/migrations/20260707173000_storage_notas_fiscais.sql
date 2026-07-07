-- Bucket para PDFs de notas fiscais (upload manual / importação)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notas-fiscais',
  'notas-fiscais',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read notas fiscais"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'notas-fiscais');

CREATE POLICY "gestao upload notas fiscais"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'notas-fiscais'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
  )
);

CREATE POLICY "gestao update notas fiscais"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'notas-fiscais'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
  )
);

CREATE POLICY "gestao delete notas fiscais"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'notas-fiscais'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
  )
);
