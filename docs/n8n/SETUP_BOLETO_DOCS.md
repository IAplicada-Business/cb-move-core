# Setup n8n — Boleto Docs (e-mail + WhatsApp)

Workflow criado no n8n Cloud (iaplicada).

| Campo | Valor |
|-------|-------|
| Nome | CB MOVE - Boleto Docs |
| ID | `Hj81THpuh8nflvCq` |
| Editor | https://iaplicada.app.n8n.cloud/workflow/Hj81THpuh8nflvCq |
| Webhook produção | `https://iaplicada.app.n8n.cloud/webhook/cbmove-boleto-docs` |
| Webhook teste | `https://iaplicada.app.n8n.cloud/webhook-test/cbmove-boleto-docs` |
| SDK fonte | [`workflow_boleto_docs.sdk.js`](workflow_boleto_docs.sdk.js) |
| Export JSON | [`workflow_boleto_docs.json`](workflow_boleto_docs.json) |

## Estado pós code-review (jul/2026)

Itens já implementados no CBmove **antes** deste workflow:

| Item | Onde | Status |
|------|------|--------|
| Split **Gerar** / **Enviar** boleto | UI + edges | Concluído |
| Edge `send-boleto-cobranca` | Supabase | Deployada |
| Dedup por `event_id` | `boleto-cobranca-queue.ts` + `cobrancas_envios` | Concluído na edge |
| Canais dinâmicos `email` / `whatsapp` | Edge (telefone ≥ 10 dígitos) | Concluído |
| Notificações Cora desligadas | `emit-boleto-cora` | Concluído |
| Auditoria `cobrancas_envios` | Migration + insert pós-webhook 2xx | Concluído na edge |

O workflow n8n **não** grava em `cobrancas_envios` — isso já é feito pela edge após resposta 200 do webhook.

## 1. Credenciais no n8n

| Credencial | Tipo | Nós | Status |
|------------|------|-----|--------|
| CB MOVE NF Webhook Secret | `httpHeaderAuth` | Webhook Boleto Docs | Reutilizada (mesma da NF) |
| Gmail OAuth2 API | `gmailOAuth2` | Enviar Gmail | Auto-vinculada |
| CB MOVE Z-API Client Token | `httpHeaderAuth` | Z-API WhatsApp | **Criar manualmente** |

### Webhook Secret

Header: `X-Webhook-Secret` — mesmo valor de `N8N_WEBHOOK_SECRET` em `integracao_config`.

### Z-API (WhatsApp)

1. Criar credencial **Header Auth** `CB MOVE Z-API Client Token`:
   - Header name: `Client-Token`
   - Value: token de segurança do painel Z-API
2. Em **Settings → Variables** do workflow (ou projeto), definir:
   - `ZAPI_INSTANCE_ID` — ID da instância
   - `ZAPI_INSTANCE_TOKEN` — token da instância
3. No nó **Z-API WhatsApp**, vincular a credencial `CB MOVE Z-API Client Token`.

Endpoint usado:

```
POST https://api.z-api.io/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_INSTANCE_TOKEN}/send-text
Body: { "phone": "5511999999999", "message": "..." }
```

Documentação: https://developer.z-api.io/en/message/send-text

## 2. Publicar workflow

1. Abrir o editor e confirmar credenciais (principalmente Z-API).
2. Testar com pin data (Amanda Pavan) em **Webhook Boleto Docs**.
3. Publicar (`active: true`).

## 3. Supabase — `integracao_config`

```bash
python scripts/apply-integracao-n8n-boleto.py
```

Ou rodar no SQL Editor:

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

- `canais` vem só com `whatsapp` se o paciente tem telefone válido (edge).
- `event_id` fixo por cobrança → dedup na edge evita reenvio duplicado.

## 5. Fluxo

```
send-boleto-cobranca (Edge)
  → valida boleto_url + email + dedup cobrancas_envios
  → POST webhook n8n + X-Webhook-Secret
  → n8n: Parse → Montar mensagens → Gmail
  → IF tem_whatsapp → Z-API send-text (continue on fail)
  → Respond 200 { ok, event_id, cobranca_id }
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
3. Verificar e-mail + WhatsApp + registro em `cobrancas_envios`

## Pendências

- [ ] Criar credencial `CB MOVE Z-API Client Token` e variáveis Z-API no n8n
- [ ] Confirmar publicação ativa após configurar Z-API
- [ ] Fase 2: `sendMedia` com PDF do `boleto_url` na Z-API
- [ ] Histórico de envios na UI (ler `cobrancas_envios`)
