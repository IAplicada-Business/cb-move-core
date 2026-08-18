# Cutover Cora produção — mTLS, webhook, E2E boleto pago

Demanda: **02 - Automação de emissão de boletos - CORA**  
Subtarefa: _Cutover Cora produção — mTLS prod, webhook prod, teste E2E boleto real pago_

## Estado atual (verificação)

```bash
python scripts/verify-cora-ambiente.py
```

Esperado **antes** do cutover:

| Chave                  | Stage (atual)                                 |
| ---------------------- | --------------------------------------------- |
| `CORA_API_BASE`        | `https://matls-clients.api.stage.cora.com.br` |
| Cert / key / client_id | Credenciais de **stage**                      |

Produção usa:

| Ambiente | `CORA_API_BASE`                               |
| -------- | --------------------------------------------- |
| Stage    | `https://matls-clients.api.stage.cora.com.br` |
| Produção | `https://matls-clients.api.cora.com.br`       |

Código: `PROD_MTLS_BASE` / `STAGE_MTLS_BASE` em `supabase/functions/_shared/cora.ts`.

## Bloqueadores (não pular)

Sem estes itens **não** aplicar produção:

1. **Credenciais mTLS de produção** da Cora (empresa CB MOVE):
   - `CORA_CLIENT_ID` (produção)
   - `certificate.pem` + `private-key.key` (produção)
2. Aprovação operacional (Diego/Charlene) para emitir boleto **real** de valor mínimo.
3. Focus NFe já em produção (se o E2E incluir auto-NF pós-pagamento). Ver `docs/CHECKLIST_PRODUCAO_FOCUS_CORA.md`.

## Passo a passo

### 1. Gravar mTLS produção em `integracao_config`

Colocar PEMs e client_id em `.env.app` (ou passar por CLI):

```bash
# .env.app
CORA_CLIENT_ID=int-...          # produção
CORA_CERTIFICATE_PATH=path/to/prod-certificate.pem
CORA_PRIVATE_KEY_PATH=path/to/prod-private-key.key
CORA_AMBIENTE=production
# opcional — senão o script escolhe PROD_MTLS_BASE:
# CORA_API_BASE=https://matls-clients.api.cora.com.br

python scripts/apply-integracao-cora.py --from-env --ambiente production
python scripts/verify-cora-ambiente.py
```

O script valida CN do certificado = `CORA_CLIENT_ID`.

### 2. Token mTLS

```bash
python scripts/test-cora-token.py
```

Deve retornar access token contra a base **produção**.

### 3. Webhook produção

Garante `CORA_WEBHOOK_SHARED_SECRET` e registra endpoint na API Cora (domínio mTLS):

```bash
python scripts/register-cora-webhook.py
```

URL registrada:

`https://grlkbtnwvxorlfglyzid.supabase.co/functions/v1/cora-webhook?secret=...`

Confirmar em `integracao_config`:

- `CORA_WEBHOOK_SHARED_SECRET`
- `CORA_WEBHOOK_ENDPOINT_ID` (novo id `end_...` de produção)

Se existir endpoint antigo de stage, remover no painel/API Cora (`DELETE /endpoints/{id}`) para não misturar ambientes.

### 4. E2E — boleto real pago

**Atenção:** em produção não existe `/v2/invoices/pay` (só stage). O pagamento é real (PIX/boleto).

Checklist mínimo:

1. UI Cobranças → **Gerar boleto** (paciente de teste / valor mínimo acordado).
2. Confirmar `boleto_url` + status aberto na cobrança.
3. Pagar o boleto/PIX de verdade.
4. Aguardar webhook + sync (`cora-webhook` / cron pagamento):
   - cobrança → `pago`
   - se `CORA_AUTO_NF_ENABLED`: NF criada / fila Focus
5. Opcional: `python scripts/test_cora_nf_automatica_e2e.py` só se adaptado a prod (não usar pay de stage).

### 5. Envio docs (e-mail + WhatsApp PDF)

Após gerar boleto:

1. **Enviar boleto** na UI.
2. Confirmar e-mail + PDF no WhatsApp (workflow Fase 2 — ver `docs/n8n/SETUP_BOLETO_DOCS.md`).
3. Linha em `cobrancas_envios`.

## Rollback

1. Reaplicar credenciais **stage** com `apply-integracao-cora.py --ambiente stage`.
2. Re-registrar webhook stage (ou desativar endpoint prod).
3. Kill switch NF: `CORA_AUTO_NF_ENABLED=false` se necessário.

## Critérios de aceite (board)

- [ ] `CORA_API_BASE` = produção mTLS
- [ ] Token mTLS prod OK
- [ ] Webhook prod registrado + secret
- [ ] 1 boleto real emitido e **pago** → cobrança `pago` (+ NF se ligado)
- [ ] Envio WhatsApp com **PDF** (não só link) após publicar n8n Fase 2
