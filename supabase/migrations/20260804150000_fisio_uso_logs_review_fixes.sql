-- Revisão RPC logs fisio: cap p_limit, deduplicar relatórios assinados, corrigir tipo depósito paciente

CREATE OR REPLACE FUNCTION public.get_fisio_uso_logs(p_fisio_id uuid, p_limit int DEFAULT 25)
RETURNS TABLE (
  id text,
  ts timestamptz,
  categoria text,
  titulo text,
  detalhe text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_manage_pacientes() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT u.id, u.ts, u.categoria, u.titulo, u.detalhe
  FROM (
    SELECT
      ('sessao-' || s.id::text) AS id,
      s.created_at AS ts,
      'sessao'::text AS categoria,
      'Sessão registrada'::text AS titulo,
      (COALESCE(pac.nome, 'Paciente') || ' · ' || s.sigla::text || ' · '
        || to_char(s.data, 'DD/MM/YYYY')) AS detalhe
    FROM public.sessoes s
    LEFT JOIN public.pacientes pac ON pac.id = s.paciente_id
    WHERE s.fisioterapeuta_id = p_fisio_id

    UNION ALL

    SELECT
      ('evolucao-' || e.id::text),
      e.created_at,
      'evolucao',
      'Evolução clínica registrada',
      COALESCE(pac.nome, 'Paciente') || ' · '
        || CASE e.fonte
          WHEN 'audio_ia' THEN 'áudio/IA'
          WHEN 'sites_import' THEN 'importação'
          ELSE 'manual'
        END
    FROM public.prontuario_evolucoes e
    LEFT JOIN public.pacientes pac ON pac.id = e.paciente_id
    WHERE e.fisioterapeuta_id = p_fisio_id

    UNION ALL

    SELECT
      ('relatorio-' || r.id::text),
      r.created_at,
      'relatorio',
      'Relatório mensal gerado',
      COALESCE(pac.nome, 'Paciente') || ' · '
        || lpad(r.competencia_mes::text, 2, '0') || '/' || r.competencia_ano::text
    FROM public.relatorios_atendimento r
    LEFT JOIN public.pacientes pac ON pac.id = r.paciente_id
    WHERE r.fisioterapeuta_id = p_fisio_id
      AND NOT (r.assinado = true AND r.assinado_em IS NOT NULL)

    UNION ALL

    SELECT
      ('relatorio-assinado-' || r.id::text),
      r.assinado_em,
      'relatorio',
      'Relatório assinado',
      COALESCE(pac.nome, 'Paciente') || ' · '
        || lpad(r.competencia_mes::text, 2, '0') || '/' || r.competencia_ano::text
    FROM public.relatorios_atendimento r
    LEFT JOIN public.pacientes pac ON pac.id = r.paciente_id
    WHERE r.fisioterapeuta_id = p_fisio_id
      AND r.assinado = true
      AND r.assinado_em IS NOT NULL

    UNION ALL

    SELECT
      ('avaliacao-' || ia.id::text),
      ia.aplicado_em,
      'avaliacao',
      'Avaliação clínica aplicada',
      COALESCE(pac.nome, 'Paciente') || ' · ' || COALESCE(ic.nome, 'Instrumento')
    FROM public.instrumentos_aplicados ia
    LEFT JOIN public.instrumentos_clinicos ic ON ic.id = ia.instrumento_id
    LEFT JOIN public.pacientes pac ON pac.id = ia.paciente_id
    WHERE ia.aplicado_por IN (
      SELECT pr.id FROM public.profiles pr WHERE pr.fisioterapeuta_id = p_fisio_id
    )

    UNION ALL

    SELECT
      ('agenda-' || ah.id::text),
      ah.created_at,
      'agenda',
      CASE
        WHEN ah.acao = 'remanejamento' THEN
          'Remanejamento na agenda (' || COALESCE(ah.escopo, 'pontual') || ')'
        WHEN ah.status_anterior IS NOT NULL OR ah.status_novo IS NOT NULL THEN
          'Frequência alterada: ' || COALESCE(ah.status_anterior, '—')
            || ' → ' || COALESCE(ah.status_novo, '—')
        ELSE 'Alteração na agenda'
      END,
      NULL::text
    FROM public.agendamento_historico ah
    INNER JOIN public.agendamentos ag ON ag.id = ah.agendamento_id
    WHERE ag.fisioterapeuta_id = p_fisio_id

    UNION ALL

    SELECT
      ('periodizacao-' || ps.id::text),
      ps.updated_at,
      'periodizacao',
      CASE
        WHEN ps.updated_at <= ps.created_at + interval '2 seconds' THEN
          'Sessão de periodização cadastrada'
        ELSE 'Periodização atualizada'
      END,
      COALESCE(pac.nome, 'Paciente') || ' · sessão ' || ps.numero_sessao::text
    FROM public.periodizacao_sessoes ps
    LEFT JOIN public.pacientes pac ON pac.id = ps.paciente_id
    WHERE ps.fisioterapeuta_id = p_fisio_id
  ) u
  ORDER BY u.ts DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
END;
$$;

-- Depósito direto do paciente: tipo particular (não convênio/sharepoint)
UPDATE public.cobrancas
SET tipo = 'particular'::public.paciente_tipo
WHERE paciente_id = 'ee171e6a-538e-48a0-bb56-b284c55c36c3'::uuid
  AND forma_pagamento = 'deposito'::public.forma_pagamento
  AND observacoes ILIKE '%Depósito paciente%'
  AND tipo IS DISTINCT FROM 'particular'::public.paciente_tipo;
