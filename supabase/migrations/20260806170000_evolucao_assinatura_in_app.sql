-- Fluxo A: assinatura in-app (evoluções diárias) + bucket de rubricas no perfil

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assinatura_storage_path text;

ALTER TABLE public.prontuario_evolucoes
  ADD COLUMN IF NOT EXISTS assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinado_por uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.profiles.assinatura_storage_path IS
  'Path no bucket assinaturas-usuarios (PNG da rubrica do fisio).';
COMMENT ON COLUMN public.prontuario_evolucoes.assinado_em IS
  'Timestamp da assinatura in-app pelo fisio responsável.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assinaturas-usuarios',
  'assinaturas-usuarios',
  false,
  524288,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "assinatura select own or admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'assinaturas-usuarios'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "assinatura insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assinaturas-usuarios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "assinatura update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'assinaturas-usuarios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "assinatura delete own or admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'assinaturas-usuarios'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "scoped update prontuario_evolucoes" ON public.prontuario_evolucoes;

CREATE POLICY "scoped update prontuario_evolucoes"
  ON public.prontuario_evolucoes FOR UPDATE TO authenticated
  USING (
    assinado_em IS NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
      OR public.has_role(auth.uid(), 'recepcao')
      OR (
        public.has_role(auth.uid(), 'fisio')
        AND public.fisio_can_access_paciente(paciente_id)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.assinar_evolucao(p_evolucao_id uuid)
RETURNS public.prontuario_evolucoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev public.prontuario_evolucoes;
  v_fisio_id uuid;
  v_has_assinatura boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.has_role(auth.uid(), 'fisio') AND NOT public.has_role(auth.uid(), 'membro') THEN
    RAISE EXCEPTION 'Somente fisioterapeuta pode assinar evoluções';
  END IF;

  SELECT p.fisioterapeuta_id,
         (p.assinatura_storage_path IS NOT NULL AND trim(p.assinatura_storage_path) <> '')
  INTO v_fisio_id, v_has_assinatura
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_fisio_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não vinculado a fisioterapeuta';
  END IF;

  IF NOT v_has_assinatura THEN
    RAISE EXCEPTION 'Cadastre sua assinatura em Minha assinatura antes de assinar';
  END IF;

  SELECT * INTO v_ev
  FROM public.prontuario_evolucoes
  WHERE id = p_evolucao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evolução não encontrada';
  END IF;

  IF v_ev.assinado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Evolução já assinada';
  END IF;

  IF v_ev.fisioterapeuta_id IS DISTINCT FROM v_fisio_id THEN
    RAISE EXCEPTION 'Somente o fisio responsável pode assinar esta evolução';
  END IF;

  IF coalesce(trim(v_ev.subjetivo), '') = ''
     OR coalesce(trim(v_ev.objetivo), '') = ''
     OR coalesce(trim(v_ev.plano), '') = '' THEN
    RAISE EXCEPTION 'Complete S/O/P antes de assinar';
  END IF;

  UPDATE public.prontuario_evolucoes
  SET
    assinado_em = now(),
    assinado_por = auth.uid(),
    updated_at = now()
  WHERE id = p_evolucao_id
  RETURNING * INTO v_ev;

  RETURN v_ev;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assinar_evolucao(uuid) TO authenticated;
