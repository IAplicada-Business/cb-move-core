import { workflow, node, trigger, ifElse, expr, newCredential } from "@n8n/workflow-sdk";

const webhookBoleto = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.1,
  config: {
    name: "Webhook Boleto Docs",
    parameters: {
      path: "cbmove-boleto-docs",
      httpMethod: "POST",
      responseMode: "responseNode",
      authentication: "headerAuth",
      options: {
        responseHeaders: {
          entries: [{ name: "Content-Type", value: "application/json" }],
        },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("CB MOVE NF Webhook Secret"),
    },
  },
});

const parsePayload = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Parse payload",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `const body = $input.first().json.body ?? $input.first().json;
if (!body.cobranca_id) throw new Error('cobranca_id obrigatório');
if (!body.boleto_url) throw new Error('boleto_url obrigatório');
if (!body.paciente?.email) throw new Error('paciente.email obrigatório');

function formatBrl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return \`\${d}/\${m}/\${y}\`;
}
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10) return \`55\${digits}\`;
  return null;
}

const pac = body.paciente || {};
const canais = Array.isArray(body.canais) ? body.canais : ['email'];
const competenciaSlug = String(body.competencia || 'boleto').replace(/[^0-9A-Za-z_-]+/g, '-');

return [{
  json: {
    ...body,
    valor_fmt: formatBrl(body.valor),
    vencimento_fmt: formatDate(body.vencimento),
    telefone_e164: normalizePhone(pac.telefone),
    tem_whatsapp: canais.includes('whatsapp') && !!normalizePhone(pac.telefone),
    to_email: pac.email,
    boleto_filename: \`boleto-cbmove-\${competenciaSlug}.pdf\`,
  },
}];`,
    },
  },
});

const montarMensagens = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Montar mensagens",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `const p = $input.first().json;
const nome = p.paciente?.nome || 'Cliente';
const assunto = \`CB MOVE — Boleto \${p.competencia || ''} — \${nome} — \${p.valor_fmt}\`.trim();

const html = \`
<p>Olá <strong>\${nome}</strong>,</p>
<p>Segue a cobrança da CB MOVE Neuroscience referente a <strong>\${p.competencia || '—'}</strong>.</p>
<ul>
<li><strong>Valor:</strong> \${p.valor_fmt}</li>
<li><strong>Vencimento:</strong> \${p.vencimento_fmt}</li>
<li><strong>Serviço:</strong> \${p.servico || 'Fisioterapia'}</li>
</ul>
<p><a href="\${p.boleto_url}">Abrir boleto (PDF)</a></p>
\${p.pix_emv ? \`<p><strong>PIX Copia e Cola:</strong></p><pre style="font-size:11px;word-break:break-all">\${p.pix_emv}</pre>\` : ''}
<p>Em caso de dúvidas, responda este e-mail ou fale conosco pelo WhatsApp.</p>
<p>CB MOVE Neuroscience</p>\`;

// Texto curto (legado / fallback). PDF vai em send-document.
let whatsapp = \`Olá \${nome}, CB MOVE — cobrança \${p.competencia || '—'}.\\n\\n\`;
whatsapp += \`Valor: \${p.valor_fmt}\\nVencimento: \${p.vencimento_fmt}\\n\`;
if (p.pix_emv) whatsapp += \`\\nPIX Copia e Cola:\\n\${p.pix_emv}\`;

// Caption do PDF (sem link — o arquivo é anexado)
let caption = \`CB MOVE — boleto \${p.competencia || '—'}\\nValor: \${p.valor_fmt}\\nVencimento: \${p.vencimento_fmt}\`;
if (p.pix_emv) caption += \`\\n\\nPIX Copia e Cola:\\n\${p.pix_emv}\`;

return [{ json: { ...p, assunto, email_html: html, whatsapp_text: whatsapp, whatsapp_caption: caption } }];`,
    },
  },
});

const enviarGmail = node({
  type: "n8n-nodes-base.gmail",
  version: 2.2,
  config: {
    name: "Enviar Gmail",
    parameters: {
      resource: "message",
      operation: "send",
      sendTo: expr("{{ $json.to_email }}"),
      subject: expr("{{ $json.assunto }}"),
      emailType: "html",
      message: expr("{{ $json.email_html }}"),
      options: {
        appendAttribution: false,
        senderName: "CB MOVE Neuroscience",
      },
    },
    credentials: {
      gmailOAuth2: newCredential("Gmail account"),
    },
  },
});

const temWhatsapp = ifElse({
  version: 2.3,
  config: {
    name: "Tem WhatsApp?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
        conditions: [
          {
            leftValue: expr('{{ $("Montar mensagens").item.json.tem_whatsapp }}'),
            operator: { type: "boolean", operation: "true" },
            rightValue: "",
          },
        ],
        combinator: "and",
      },
    },
  },
});

const zapiWhatsappPdf = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Z-API WhatsApp PDF",
    onError: "continueRegularOutput",
    parameters: {
      method: "POST",
      // Fase 2: PDF via send-document/pdf (equivale ao sendMedia do board)
      // Docs: https://developer.z-api.io/message/send-document
      url: "={{ 'https://api.z-api.io/instances/' + $env.ZAPI_INSTANCE_ID + '/token/' + $env.ZAPI_INSTANCE_TOKEN + '/send-document/pdf' }}",
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: "Content-Type", value: "application/json" }],
      },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '={{ { phone: $("Montar mensagens").item.json.telefone_e164, document: $("Montar mensagens").item.json.boleto_url, fileName: $("Montar mensagens").item.json.boleto_filename, caption: $("Montar mensagens").item.json.whatsapp_caption } }}',
      ),
      options: {
        response: { response: { neverError: true } },
      },
    },
    credentials: {
      httpHeaderAuth: newCredential("CB MOVE Z-API Client Token"),
    },
  },
});

const respondOk = node({
  type: "n8n-nodes-base.respondToWebhook",
  version: 1.5,
  config: {
    name: "Respond 200",
    parameters: {
      respondWith: "json",
      responseBody: expr(
        '={{ { ok: true, event_id: $("Parse payload").item.json.event_id, cobranca_id: $("Parse payload").item.json.cobranca_id, whatsapp: "pdf" } }}',
      ),
      options: { responseCode: 200 },
    },
  },
});

export default workflow("cbmove-boleto-docs", "CB MOVE - Boleto Docs")
  .add(webhookBoleto)
  .to(parsePayload)
  .to(montarMensagens)
  .to(enviarGmail)
  .to(temWhatsapp.onTrue(zapiWhatsappPdf.to(respondOk)).onFalse(respondOk));
