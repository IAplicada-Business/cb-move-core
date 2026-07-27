-- A8: templates RQ.GPS com renderer/output_format/required_placeholders
UPDATE public.templates_versionados
SET conteudo = '{
  "codigo_rq": "RQ.GPS.09.105",
  "renderer": "pdf-grade-v2",
  "output_format": "pdf",
  "required_placeholders": ["paciente_nome"],
  "placeholders": ["paciente_nome", "competencia", "evolucao_resumo"]
}'::jsonb
WHERE codigo = 'RQ.GPS.09.105' AND tipo = 'relatorio_atendimento';

UPDATE public.templates_versionados
SET conteudo = '{
  "codigo_rq": "RQ.GPS.09.106",
  "renderer": "docx-unimed-v1",
  "output_format": "docx",
  "required_placeholders": ["paciente_nome"],
  "placeholders": ["paciente_nome", "cid", "sessoes", "processo"]
}'::jsonb
WHERE codigo = 'RQ.GPS.09.106' AND tipo = 'relatorio_atendimento';

UPDATE public.templates_versionados
SET conteudo = '{
  "codigo_rq": "RQ.GPS.09.107",
  "renderer": "dual-judicial-v1",
  "output_format": "dual",
  "required_placeholders": ["paciente_nome", "processo"],
  "placeholders": ["paciente_nome", "sessoes", "fisio"]
}'::jsonb
WHERE codigo = 'RQ.GPS.09.107' AND tipo = 'relatorio_atendimento';

UPDATE public.templates_versionados
SET conteudo = '{
  "codigo_rq": "RQ.GPS.09.108",
  "renderer": "xlsx-puc-v1",
  "output_format": "xlsx",
  "required_placeholders": ["paciente_nome"],
  "placeholders": ["paciente_nome", "competencia", "evolucao_resumo"]
}'::jsonb
WHERE codigo = 'RQ.GPS.09.108' AND tipo = 'relatorio_atendimento';

-- Storage: aceitar DOCX e XLSX além de PDF
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'relatorios-atendimento';
