# Cron — cobranças vencidas

Edge Function: `atualizar-cobrancas-vencidas`  
RPC: `atualizar_cobrancas_vencidas()` — marca como `vencido` cobranças com `vencimento < hoje` e status em `pendente`, `aguardando_convenio` ou `aguardando_alvara`.

## 1. Secret (recomendado)

Gere um valor aleatório (ex.: `openssl rand -hex 32`) e grave em `integracao_config`:

```sql
INSERT INTO public.integracao_config (chave, valor)
VALUES ('CRON_SECRET', '<seu-secret>')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, atualizado_em = now();
```

Ou use [`scripts/seed-integracao-n8n.sql`](../scripts/seed-integracao-n8n.sql) (inclui `CRON_SECRET`).

## 2. Agendar no Supabase

1. [Dashboard → Edge Functions](https://supabase.com/dashboard/project/grlkbtnwvxorlfglyzid/functions)
2. Abra `atualizar-cobrancas-vencidas` → **Schedules** (ou Cron)
3. Nova schedule:
   - **Cron:** `0 6 * * *` (06:00 UTC diário — ajuste fuso se necessário)
   - **Método:** `POST`
   - **Header:** `x-cron-secret: <CRON_SECRET>`

Alternativa sem secret: usar `Authorization: Bearer <SERVICE_ROLE_KEY>` (menos recomendado em schedulers externos).

## 3. Agendar no n8n (alternativa)

Workflow com **Schedule Trigger** (diário) + **HTTP Request**:

| Campo | Valor |
|-------|-------|
| URL | `https://grlkbtnwvxorlfglyzid.supabase.co/functions/v1/atualizar-cobrancas-vencidas` |
| Method | POST |
| Header | `x-cron-secret: <CRON_SECRET>` |

## 4. Teste manual

```bash
curl -X POST \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://grlkbtnwvxorlfglyzid.supabase.co/functions/v1/atualizar-cobrancas-vencidas
```

Resposta esperada: `{"ok":true,"atualizadas":<n>}`

## 5. Checklist pós-deploy

- [ ] `CRON_SECRET` em `integracao_config`
- [ ] Function deployada (`supabase functions deploy atualizar-cobrancas-vencidas`)
- [ ] Schedule ativa no Dashboard ou n8n
- [ ] Primeira execução registrada (logs da function)
