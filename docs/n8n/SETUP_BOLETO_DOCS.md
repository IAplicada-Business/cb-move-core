# Setup n8n — Boleto Docs (e-mail + WhatsApp PDF)

Workflow criado no n8n Cloud (iaplicada).

| Campo            | Valor                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Nome             | CB MOVE - Boleto Docs                                             |
| ID               | `Hj81THpuh8nflvCq`                                                |
| Editor           | https://iaplicada.app.n8n.cloud/workflow/Hj81THpuh8nflvCq         |
| Webhook produção | `https://iaplicada.app.n8n.cloud/webhook/cbmove-boleto-docs`      |
| Webhook teste    | `https://iaplicada.app.n8n.cloud/webhook-test/cbmove-boleto-docs` |
| SDK fonte        | [`workflow_boleto_docs.sdk.js`](workflow_boleto_docs.sdk.js)      |
| Export JSON      | [`workflow_boleto_docs.json`](workflow_boleto_docs.json)          |

## Fase 2 (ago/2026) — PDF no WhatsApp

O nó **Z-API WhatsApp** (`send-text` com link) foi substituído por **Z-API WhatsApp PDF** (`send-document/pdf`).

| Campo no body Z-API | Origem no workflow                                      |
| ------------------- | ------------------------------------------------------- |
| `phone`             | `telefone_e164`                                         |
| `document`          | `boleto_url` (URL pública do PDF Cora)                  |
| `fileName`          | `boleto_filename` (`boleto-cbmove-{competencia}.pdf`)   |
| `caption`           | `whatsapp_caption` (valor/vencimento/PIX, **sem** link) |

Documentação Z-API: https://developer.z-api.io/message/send-document

### Aplicar no n8n Cloud (obrigatório)

O repositório já tem o JSON/SDK atualizados. No Cloud ainda é preciso:

1. Abrir o workflow `Hj81THpuh8nflvCq` **ou** importar [`workflow_boleto_docs.json`](workflow_boleto_docs.json).
2. Confirmar credencial `CB MOVE Z-API Client Token` + variáveis `ZAPI_INSTANCE_ID` / `ZAPI_INSTANCE_TOKEN`.
3. Testar com pin data (Amanda) — deve chegar PDF no WhatsApp, não só texto.
4. Publicar (`active: true`).

## Estado pós code-review

Itens já implementados no CBmove **antes** deste workflow:

| Item                                  | Onde                                            | Status                          |
| ------------------------------------- | ----------------------------------------------- | ------------------------------- |
| Split **Gerar** / **Enviar** boleto   | UI + edges                                      | Concluído                       |
| Edge `send-boleto-cobranca`           | Supabase                                        | Deployada                       |
| Dedup por `event_id`                  | `boleto-cobranca-queue.ts` + `cobrancas_envios` | Concluído na edge               |
| Canais dinâmicos `email` / `whatsapp` | Edge (telefone ≥ 10 dígitos)                    | Concluído                       |
| Notificações Cora desligadas          | `emit-boleto-cora`                              | Concluído                       |
| Auditoria `cobrancas_envios`          | Migration + insert pós-webhook 2xx              | Concluído na edge               |
| WhatsApp PDF (`send-document/pdf`)    | n8n JSON + SDK neste repo                       | **Repo OK** — publicar no Cloud |

O workflow n8n **não** grava em `cobrancas_envios` — isso já é feito pela edge após resposta 200 do webhook.

## 1. Credenciais no n8n

| Credencial                 | Tipo             | Nós                 | Status                    |
| -------------------------- | ---------------- | ------------------- | ------------------------- |
| CB MOVE NF Webhook Secret  | `httpHeaderAuth` | Webhook Boleto Docs | Reutilizada (mesma da NF) |
| Gmail OAuth2 API           | `gmailOAuth2`    | Enviar Gmail        | Auto-vinculada            |
| CB MOVE Z-API Client Token | `httpHeaderAuth` | Z-API WhatsApp PDF  | **Criar / confirmar**     |

### Webhook Secret

Header: `X-Webhook-Secret` — mesmo valor de `N8N_WEBHOOK_SECRET` em `integracao_config`.

### Z-API (WhatsApp)

1. Credencial **Header Auth** `CB MOVE Z-API Client Token`:
   - Header name: `Client-Token`
   - Value: token de segurança do painel Z-API
2. Variables do workflow/projeto:
   - `ZAPI_INSTANCE_ID`
   - `ZAPI_INSTANCE_TOKEN`
3. No nó **Z-API WhatsApp PDF**, vincular a credencial acima.

Endpoint (Fase 2):

```
POST https://api.z-api.io/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_INSTANCE_TOKEN}/send-document/pdf
Body: {
  "phone": "5511999999999",
  "document": "https://.../boleto.pdf",
  "fileName": "boleto-cbmove-07-2026.pdf",
  "caption": "CB MOVE — boleto ..."
}
```

## 2. Publicar workflow

1. Abrir o editor e confirmar credenciais (principalmente Z-API).
2. Testar com pin data (Amanda Pavan) em **Webhook Boleto Docs**.
3. Publicar (`active: true`).

## 3. Supabase — `integracao_config`

```bash
python scripts/apply-integracao-n8n-boleto.py
```

Ou SQL:

```sql
INSERT INTO public.integracao_config (chave, valor)
VALUES ('N8N_WEBHOOK_BOLETO_DOCS', 'https://iaplicada.app.n8n.cloud/webhook/cbmove-boleto-docs')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now();
```

Garantir que `N8N_WEBHOOK_SECRET` já está configurado (mesmo da NF).

## 4. Payload do webhook

Enviado por [`boleto-cobranca-queue.ts`](../../supabase/functions/_shared/boleto-cobranca-queue.ts):

```json
{
  "event": "boleto.enviar",
  "event_id": "boleto-docs-{cobranca_id}",
  "reenvio": false,
  "cobranca_id": "uuid",
  "valor": 2128,
  "vencimento": "2026-07-15",
  "competencia": "07/2026",
  "servico": "Fisioterapia Neurológica",
  "boleto_url": "https://.../boleto.pdf",
  "pix_emv": "000201...",
  "paciente": {
    "nome": "Amanda Pavan",
    "email": "pavan.amandaa@gmail.com",
    "cpf": "03555110020",
    "telefone": "51992436874"
  },
  "canais": ["email", "whatsapp"]
}
```

## 5. Fluxo

```
send-boleto-cobranca (Edge)
  → valida boleto_url + email + dedup cobrancas_envios
  → POST webhook n8n + X-Webhook-Secret
  → n8n: Parse → Montar mensagens → Gmail
  → IF tem_whatsapp → Z-API send-document/pdf (continue on fail)
  → Respond 200 { ok, event_id, cobranca_id, whatsapp: "pdf" }
  → Edge INSERT cobrancas_envios
```

## 6. Testes

### Pin data (editor n8n)

Usar payload Amanda Pavan em `workflow_boleto_docs.json` → `pinData`.

### Script E2E (Supabase → edge → n8n)

```bash
python scripts/test-send-boleto-cobranca.py
```

### UI

1. Cobranças → paciente com boleto gerado
2. **Enviar boleto**
3. Verificar e-mail + **PDF no WhatsApp** + registro em `cobrancas_envios`

## Pendências

- [ ] Confirmar credencial Z-API + variáveis no n8n Cloud
- [ ] Reimportar/publicar workflow com nó PDF
- [ ] Smoke: 1 envio real (telefone de teste) após publicar
- [ ] Histórico de envios na UI (ler `cobrancas_envios`)
