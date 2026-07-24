-- Corrige resolver_destinatario_nf quando convenio_id é NULL (v_conv não atribuído)

CREATE OR REPLACE FUNCTION public.resolver_destinatario_nf(p_cobranca_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cob record;
  v_conv record;
  v_result jsonb;
  v_has_conv boolean := false;
BEGIN
  SELECT c.*, p.nome AS paciente_nome, p.cpf AS paciente_cpf,
         p.email AS paciente_email, p.telefone AS paciente_telefone,
         p.numero_processo, p.convenio_id, p.tipo AS paciente_tipo
  INTO v_cob
  FROM public.cobrancas c
  JOIN public.pacientes p ON p.id = c.paciente_id
  WHERE c.id = p_cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobrança não encontrada';
  END IF;

  IF v_cob.convenio_id IS NOT NULL THEN
    SELECT * INTO v_conv FROM public.convenios WHERE id = v_cob.convenio_id;
    v_has_conv := FOUND;
  END IF;

  v_result := jsonb_build_object(
    'cobranca_id', v_cob.id,
    'paciente_id', v_cob.paciente_id,
    'paciente_nome', v_cob.paciente_nome,
    'tipo', v_cob.tipo,
    'valor', v_cob.valor,
    'competencia_mes', v_cob.competencia_mes,
    'competencia_ano', v_cob.competencia_ano
  );

  CASE v_cob.tipo
    WHEN 'particular' THEN
      v_result := v_result || jsonb_build_object(
        'destinatario_nome', v_cob.paciente_nome,
        'destinatario_documento', v_cob.paciente_cpf,
        'tomador_email', v_cob.paciente_email,
        'tomador_telefone', v_cob.paciente_telefone,
        'template_codigo', 'RQ.GPS.07.001'
      );
    WHEN 'convenio' THEN
      IF v_has_conv THEN
        v_result := v_result || jsonb_build_object(
          'destinatario_nome', COALESCE(v_conv.razao_social, v_conv.nome, 'Convênio'),
          'destinatario_documento', v_conv.cnpj,
          'tomador_email', v_conv.email_nf,
          'tomador_endereco', v_conv.endereco,
          'tomador_cep', v_conv.cep,
          'tomador_cidade', v_conv.cidade,
          'tomador_uf', v_conv.uf,
          'tomador_codigo_municipio_ibge', v_conv.codigo_municipio_ibge,
          'template_codigo', 'RQ.GPS.07.002'
        );
      ELSE
        v_result := v_result || jsonb_build_object(
          'destinatario_nome', 'Convênio',
          'destinatario_documento', NULL,
          'template_codigo', 'RQ.GPS.07.002'
        );
      END IF;
    WHEN 'judicial' THEN
      IF v_has_conv THEN
        v_result := v_result || jsonb_build_object(
          'destinatario_nome', COALESCE(v_conv.razao_social, v_conv.nome, 'Bradesco Seguros'),
          'destinatario_documento', v_conv.cnpj,
          'tomador_email', v_conv.email_nf,
          'tomador_endereco', v_conv.endereco,
          'tomador_cep', v_conv.cep,
          'tomador_cidade', v_conv.cidade,
          'tomador_uf', v_conv.uf,
          'tomador_codigo_municipio_ibge', v_conv.codigo_municipio_ibge,
          'corpo_paciente_nome', v_cob.paciente_nome,
          'corpo_paciente_cpf', v_cob.paciente_cpf,
          'corpo_numero_processo', v_cob.numero_processo,
          'corpo_total_sessoes', v_cob.qtd_sessoes,
          'template_codigo', 'RQ.GPS.07.003'
        );
      ELSE
        v_result := v_result || jsonb_build_object(
          'destinatario_nome', 'Bradesco Seguros',
          'destinatario_documento', NULL,
          'corpo_paciente_nome', v_cob.paciente_nome,
          'corpo_paciente_cpf', v_cob.paciente_cpf,
          'corpo_numero_processo', v_cob.numero_processo,
          'corpo_total_sessoes', v_cob.qtd_sessoes,
          'template_codigo', 'RQ.GPS.07.003'
        );
      END IF;
    WHEN 'puc' THEN
      IF v_has_conv THEN
        v_result := v_result || jsonb_build_object(
          'destinatario_nome', COALESCE(v_conv.razao_social, v_conv.nome, 'PUCRS'),
          'destinatario_documento', v_conv.cnpj,
          'tomador_email', v_conv.email_nf,
          'tomador_endereco', v_conv.endereco,
          'tomador_cep', v_conv.cep,
          'tomador_cidade', v_conv.cidade,
          'tomador_uf', v_conv.uf,
          'tomador_codigo_municipio_ibge', v_conv.codigo_municipio_ibge,
          'template_codigo', 'RQ.GPS.07.002'
        );
      ELSE
        v_result := v_result || jsonb_build_object(
          'destinatario_nome', 'PUCRS',
          'destinatario_documento', NULL,
          'template_codigo', 'RQ.GPS.07.002'
        );
      END IF;
    ELSE
      v_result := v_result || jsonb_build_object(
        'destinatario_nome', v_cob.paciente_nome,
        'destinatario_documento', v_cob.paciente_cpf,
        'tomador_email', v_cob.paciente_email,
        'tomador_telefone', v_cob.paciente_telefone
      );
  END CASE;

  RETURN v_result;
END;
$$;
