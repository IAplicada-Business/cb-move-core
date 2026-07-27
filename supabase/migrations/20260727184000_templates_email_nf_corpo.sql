-- Preenche corpos dos templates de e-mail NF (RQ.GPS.08.*) — antes: "placeholder"
-- Placeholders alinhados ao payload de send-nf-email (nf-email-payload.ts)

UPDATE public.templates_versionados
SET conteudo = jsonb_build_object(
  'assunto', 'CB MOVE NF {{numero}} — {{corpo_paciente_nome}} — {{competencia_label}}',
  'corpo_html', $html$<p>Prezado(a) <strong>{{destinatario_nome}}</strong>,</p>
<p>Segue a Nota Fiscal de Serviços da <strong>CB MOVE Neuroscience</strong> referente a <strong>{{competencia_label}}</strong>.</p>
<ul>
<li><strong>NF nº:</strong> {{numero}}</li>
<li><strong>Paciente:</strong> {{corpo_paciente_nome}}</li>
<li><strong>Valor:</strong> {{valor}}</li>
</ul>
<p><a href="{{pdf_url}}">Abrir PDF da nota fiscal</a></p>
<p>Em caso de dúvidas, responda este e-mail.</p>
<p>CB MOVE Neuroscience</p>$html$,
  'placeholders', jsonb_build_array(
    'numero', 'competencia_label', 'corpo_paciente_nome', 'destinatario_nome', 'valor', 'pdf_url'
  )
)
WHERE codigo = 'RQ.GPS.08.001' AND versao = 1 AND conteudo->>'corpo' = 'placeholder';

UPDATE public.templates_versionados
SET conteudo = jsonb_build_object(
  'assunto', 'CB MOVE NF {{numero}} — {{destinatario_nome}} — {{competencia_label}}',
  'corpo_html', $html$<p>Prezado(a) <strong>{{destinatario_nome}}</strong>,</p>
<p>Segue a Nota Fiscal de Serviços referente a <strong>{{competencia_label}}</strong>.</p>
<ul>
<li><strong>NF nº:</strong> {{numero}}</li>
<li><strong>Convênio/tomador:</strong> {{destinatario_nome}}</li>
<li><strong>Paciente atendido:</strong> {{corpo_paciente_nome}}</li>
<li><strong>Valor:</strong> {{valor}}</li>
</ul>
<p><a href="{{pdf_url}}">Abrir PDF da nota fiscal</a></p>
<p>CB MOVE Neuroscience</p>$html$,
  'placeholders', jsonb_build_array(
    'numero', 'competencia_label', 'destinatario_nome', 'corpo_paciente_nome', 'valor', 'pdf_url'
  )
)
WHERE codigo = 'RQ.GPS.08.002' AND versao = 1 AND conteudo->>'corpo' = 'placeholder';

UPDATE public.templates_versionados
SET conteudo = jsonb_build_object(
  'assunto', 'CB MOVE NF {{numero}} — {{corpo_paciente_nome}} — Proc. {{corpo_numero_processo}} — {{competencia_label}}',
  'corpo_html', $html$<p>Prezado(a) <strong>{{destinatario_nome}}</strong>,</p>
<p>Segue a Nota Fiscal de Serviços referente a <strong>{{competencia_label}}</strong>.</p>
<ul>
<li><strong>NF nº:</strong> {{numero}}</li>
<li><strong>Paciente:</strong> {{corpo_paciente_nome}} (CPF {{corpo_paciente_cpf}})</li>
<li><strong>Processo:</strong> {{corpo_numero_processo}}</li>
<li><strong>Sessões no período:</strong> {{corpo_total_sessoes}}</li>
<li><strong>Valor:</strong> {{valor}}</li>
</ul>
<p><a href="{{pdf_url}}">Abrir PDF da nota fiscal</a></p>
<p>CB MOVE Neuroscience</p>$html$,
  'placeholders', jsonb_build_array(
    'numero', 'competencia_label', 'destinatario_nome', 'corpo_paciente_nome', 'corpo_paciente_cpf',
    'corpo_numero_processo', 'corpo_total_sessoes', 'valor', 'pdf_url'
  )
)
WHERE codigo = 'RQ.GPS.08.003' AND versao = 1 AND conteudo->>'corpo' = 'placeholder';
