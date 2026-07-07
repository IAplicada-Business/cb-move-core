# Setup n8n — E-mail de NF

Workflow criado no n8n Cloud (iaplicada).

| Campo | Valor |
|-------|-------|
| Nome | CB MOVE - NF Email |
| ID | `CYwb8MLR3TUmLyLo` |
| Editor | https://iaplicada.app.n8n.cloud/workflow/CYwb8MLR3TUmLyLo |
| Webhook produção | `https://iaplicada.app.n8n.cloud/webhook/cbmove-nf-email` |
| Webhook teste | `https://iaplicada.app.n8n.cloud/webhook-test/cbmove-nf-email` |
| Status | **Publicado e ativo** (07/07/2026) |

## 1. Credenciais no n8n (criadas)

| Credencial | ID | Tipo | Nós |
|------------|-----|------|-----|
| CB MOVE Supabase | `ivOTcYwW1oFZD21x` | `supabaseApi` | Buscar NF, Buscar template, Log |
| CB MOVE NF Webhook Secret | `fqaqSa6FSxk7sY26` | `httpHeaderAuth` | Webhook NF Email |

> O valor do webhook secret está em n8n → Credentials → **CB MOVE NF Webhook Secret** (header `X-Webhook-Secret`).

### Envio de e-mail (MVP)

Sem API key Resend disponível, o nó **Enviar Resend** foi trocado por **Enviar Gmail** (credencial `Gmail OAuth2 API` já existente). Quando tiver `re_...`, recriar credencial Resend e restaurar o nó HTTP.

### CB MOVE Resend (`httpBearerAuth`) — pendente
- Token: `re_...` (Resend Dashboard)

Usar no nó: Enviar Resend.

## 2. Publicar workflow — concluído

Workflow publicado em produção (`active: true`).

## 3. Secrets no Supabase (Edge Functions)

**Opção A — Dashboard** (requer permissão de Owner no projeto):

```
N8N_WEBHOOK_NF_EMAIL=https://iaplicada.app.n8n.cloud/webhook/cbmove-nf-email
N8N_WEBHOOK_SECRET=<copiar de n8n Credentials → CB MOVE NF Webhook Secret>
```

**Opção B — SQL Editor** (se o dashboard não permite criar secrets):

1. Aplicar migration `20260707164000_integracao_config.sql` (`supabase db push`)
2. Rodar [`scripts/seed-integracao-n8n.sql`](../scripts/seed-integracao-n8n.sql) no [SQL Editor](https://supabase.com/dashboard/project/grlkbtnwvxorlfglyzid/sql/new), substituindo `<WEBHOOK_SECRET>`
3. Redeploy da function `send-nf-email` (código lê env **ou** tabela `integracao_config`)

> As chaves `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` do app **não** substituem os secrets das Edge Functions.

Redeploy das functions `send-nf-email` e `emit-nf` após adicionar secrets.

## 4. Payload do webhook

A Edge Function envia payload completo (evento alinhado ao n8n):

```json
{
  "event": "nf_emitida",
  "event_id": "nf-email-<uuid>-<timestamp>",
  "nf_id": "uuid-da-nota",
  "tipo": "particular|convenio|judicial|puc",
  "reenvio": false,
  "numero": "2085",
  "valor": 2394,
  "emissao": "2026-04-30",
  "pdf_url": "https://.../notas-fiscais/nf/2026/2085.pdf",
  "competencia_mes": 4,
  "competencia_ano": 2026,
  "competencia_label": "Abr/2026",
  "destinatario_nome": "AMANDA PAVAN",
  "destinatario_documento": "035.551.100-20",
  "corpo_paciente_nome": "Amanda Pavan",
  "corpo_paciente_cpf": "035.551.100-20",
  "to_email": "paciente@email.com",
  "cc_emails": [],
  "template_codigo": "RQ.GPS.08.001",
  "assunto_sugerido": "CB MOVE NF 2085 — Amanda Pavan — Abr/2026"
}
```

> `to_email` pode ser `null` se o paciente/convênio não tiver e-mail cadastrado — o n8n deve tratar esse caso.

## 5. Fluxo

```
send-nf-email (Edge) → POST webhook n8n (payload completo)
  → INSERT notas_fiscais_envios (event_id + assunto) — feito pela Edge
  → n8n: Buscar template + Enviar Gmail/Resend
  → Respond 200
```

## 6. Cron cobranças vencidas

Edge Function `atualizar-cobrancas-vencidas` chama RPC `atualizar_cobrancas_vencidas()`.

Autorização: `Authorization: Bearer <SERVICE_ROLE_KEY>` ou header `x-cron-secret` (configurar `CRON_SECRET` em `integracao_config`).

Agendar no Supabase Dashboard → Edge Functions → Cron, ou n8n diário.

## Pendências pós-MVP

- Anexar PDF da NF no e-mail Resend (campo `attachments` com URL do Storage)
- Resolver `to_email` real (paciente.email / convenios.email_nf) no nó Montar email
- CC advogado em judicial (`advogado_email`)
