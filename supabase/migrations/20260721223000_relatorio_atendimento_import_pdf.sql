-- Importação de Relatório de Atendimento (scan físico) na aba Documentos do prontuário

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

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'fisio')
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
        assinado_em = COALESCE(assinado_em, now())
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
    'documento_fisico'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_relatorio_atendimento_pdf_url(
  p_relatorio_id uuid,
  p_pdf_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_pdf_url IS NULL THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestao')
    ) THEN
      RAISE EXCEPTION 'Sem permissao para remover PDF do relatorio';
    END IF;
  ELSIF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestao')
    OR public.has_role(auth.uid(), 'fisio')
    OR public.has_role(auth.uid(), 'membro')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para atualizar PDF do relatorio';
  END IF;

  UPDATE public.relatorios_atendimento
  SET pdf_url = p_pdf_url,
      assinado = CASE WHEN p_pdf_url IS NULL THEN false ELSE assinado END,
      assinado_em = CASE WHEN p_pdf_url IS NULL THEN NULL ELSE assinado_em END
  WHERE id = p_relatorio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relatorio nao encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.import_relatorio_atendimento_pdf(uuid, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_relatorio_atendimento_pdf(uuid, int, int, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_relatorio_atendimento_pdf_url(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_relatorio_atendimento_pdf_url(uuid, text) TO authenticated;
