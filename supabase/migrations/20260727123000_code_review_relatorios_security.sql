-- Code review fixes: segurança relatórios, portal cliente, bucket privado, RPC financeira

-- ---------------------------------------------------------------------------
-- Helpers de permissão
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.staff_has_full_patient_access()
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'membro'::public.app_role
      )
      AND NOT public.is_clinical_fisio_user()
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_finance_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.paciente_portal_can_read_relatorio(p_paciente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pacientes p
    WHERE p.id = p_paciente_id
      AND p.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.paciente_portal_can_read_relatorio(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Schema relatórios
-- ---------------------------------------------------------------------------
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS cid text;

COMMENT ON COLUMN public.pacientes.cid IS 'CID principal para relatórios de convênio (ex.: G80.9)';

ALTER TABLE public.relatorios_atendimento
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.relatorios_atendimento
  ADD COLUMN IF NOT EXISTS clicksign_document_key text;

UPDATE public.relatorios_atendimento
SET status = CASE
  WHEN assinado = true THEN 'assinado'
  WHEN status IS NULL OR trim(status) = '' THEN 'gerado'
  ELSE status
END
WHERE status IS NULL OR trim(status) = '' OR (assinado = true AND status <> 'assinado');

ALTER TABLE public.relatorios_atendimento
  ALTER COLUMN status SET DEFAULT 'gerado';

-- Remove duplicatas de relatórios digitais (mantém o mais recente por competência)
DELETE FROM public.relatorio_atendimento_linhas lin
USING public.relatorios_atendimento r_old
WHERE lin.relatorio_id = r_old.id
  AND r_old.modelo_pdf IN ('grade_v2', 'legado')
  AND EXISTS (
    SELECT 1
    FROM public.relatorios_atendimento r_new
    WHERE r_new.paciente_id = r_old.paciente_id
      AND r_new.competencia_mes = r_old.competencia_mes
      AND r_new.competencia_ano = r_old.competencia_ano
      AND r_new.modelo_pdf IN ('grade_v2', 'legado')
      AND r_new.created_at > r_old.created_at
  );

DELETE FROM public.relatorios_atendimento r_old
WHERE r_old.modelo_pdf IN ('grade_v2', 'legado')
  AND EXISTS (
    SELECT 1
    FROM public.relatorios_atendimento r_new
    WHERE r_new.paciente_id = r_old.paciente_id
      AND r_new.competencia_mes = r_old.competencia_mes
      AND r_new.competencia_ano = r_old.competencia_ano
      AND r_new.modelo_pdf IN ('grade_v2', 'legado')
      AND r_new.created_at > r_old.created_at
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_relatorios_competencia_sistema
  ON public.relatorios_atendimento (paciente_id, competencia_mes, competencia_ano)
  WHERE modelo_pdf IN ('grade_v2', 'legado');

-- ---------------------------------------------------------------------------
-- RLS portal cliente
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cliente select own relatorios assinados" ON public.relatorios_atendimento;
CREATE POLICY "cliente select own relatorios assinados"
  ON public.relatorios_atendimento FOR SELECT TO authenticated
  USING (
    public.paciente_portal_can_read_relatorio(paciente_id)
    AND (assinado = true OR status = 'assinado')
  );

-- ---------------------------------------------------------------------------
-- Bucket privado + policies de leitura
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'relatorios-atendimento';

DROP POLICY IF EXISTS "staff read relatorios atendimento pdf" ON storage.objects;
CREATE POLICY "staff read relatorios atendimento pdf"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'relatorios-atendimento'
    AND (
      public.staff_has_full_patient_access()
      OR public.is_clinical_fisio_user()
    )
  );

DROP POLICY IF EXISTS "cliente read own relatorios pdf" ON storage.objects;
CREATE POLICY "cliente read own relatorios pdf"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'relatorios-atendimento'
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.user_id = auth.uid()
        AND name LIKE ('relatorio-' || p.id::text || '-%')
    )
  );

-- ---------------------------------------------------------------------------
-- RPC cobrancas_sem_nf — gate financeiro
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cobrancas_sem_nf(int, int);

CREATE OR REPLACE FUNCTION public.cobrancas_sem_nf(p_mes int, p_ano int)
RETURNS TABLE (
  cobranca_id uuid,
  paciente_id uuid,
  paciente_nome text,
  paciente_cpf text,
  paciente_telefone text,
  tipo public.paciente_tipo,
  valor numeric,
  competencia_mes int,
  competencia_ano int,
  destinatario_nome text,
  destinatario_documento text,
  status public.cobranca_status
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    NULL;
  ELSIF NOT public.has_finance_access() THEN
    RAISE EXCEPTION 'Sem permissao financeira';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.paciente_id,
    p.nome,
    p.cpf,
    p.telefone,
    c.tipo,
    c.valor,
    c.competencia_mes,
    c.competencia_ano,
    (public.resolver_destinatario_nf(c.id)->>'destinatario_nome'),
    (public.resolver_destinatario_nf(c.id)->>'destinatario_documento'),
    c.status
  FROM public.cobrancas c
  JOIN public.pacientes p ON p.id = c.paciente_id
  WHERE c.competencia_mes = p_mes
    AND c.competencia_ano = p_ano
    AND c.status IN ('pago', 'pendente', 'aguardando_convenio', 'aguardando_alvara', 'vencido', 'atrasado')
    AND NOT EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.cobranca_id = c.id AND nf.status <> 'cancelada'
    )
  ORDER BY p.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.cobrancas_sem_nf(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cobrancas_sem_nf(int, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Import físico — status assinado unificado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_relatorio_atendimento_pdf(
  p_paciente_id uuid,
  p_competencia_mes int,
  p_competencia_ano int,
  p_pdf_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_modelo public.modelo_relatorio;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF public.is_clinical_fisio_user()
    AND NOT public.fisio_can_access_paciente(p_paciente_id) THEN
    RAISE EXCEPTION 'Sem permissao para importar relatorio deste paciente';
  END IF;

  IF NOT (
    public.staff_has_full_patient_access()
    OR public.is_clinical_fisio_user()
    OR public.has_role(auth.uid(), 'membro')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para importar relatorio de atendimento';
  END IF;

  IF p_pdf_url IS NULL OR length(trim(p_pdf_url)) = 0 THEN
    RAISE EXCEPTION 'URL do PDF invalida';
  END IF;

  SELECT id INTO v_id
  FROM public.relatorios_atendimento
  WHERE paciente_id = p_paciente_id
    AND competencia_mes = p_competencia_mes
    AND competencia_ano = p_competencia_ano
    AND modelo_pdf = 'documento_fisico'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.relatorios_atendimento
    SET pdf_url = p_pdf_url,
        assinado = true,
        assinado_em = COALESCE(assinado_em, now()),
        status = 'assinado'
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  SELECT COALESCE(modelo_relatorio_preferido, 'convencional'::public.modelo_relatorio)
  INTO v_modelo
  FROM public.pacientes
  WHERE id = p_paciente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente nao encontrado';
  END IF;

  INSERT INTO public.relatorios_atendimento (
    paciente_id,
    modelo,
    competencia_mes,
    competencia_ano,
    pdf_url,
    assinado,
    assinado_em,
    status,
    modelo_pdf
  )
  VALUES (
    p_paciente_id,
    v_modelo,
    p_competencia_mes,
    p_competencia_ano,
    p_pdf_url,
    true,
    now(),
    'assinado',
    'documento_fisico'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
