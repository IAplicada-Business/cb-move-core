# Handoff — Fiscal, NF e Boleto (23/07/2026)

Contexto para retomar amanhã. Migrations e edge functions **já aplicadas/deployadas** em `grlkbtnwvxorlfglyzid`.

## O que foi entregue (código)

| Funcionalidade | Onde | Observação |
|----------------|------|------------|
| NF automática no pagamento | `cora-payment-sync`, `auto-nf-apos-pagamento`, `marcarComoPago` | Manual + Cora; respeita `modo_emissao_nf = data_especifica` |
| NF em data específica | Migration phase3 + `nf-emissao-data-especifica` cron 08:00 BRT | UI Pacientes; **0 pacientes** configurados em prod |
| Boleto em data específica | `20260723180000_*` + `boleto-emissao-data-especifica` cron 08:15 BRT | UI Pacientes; **1 paciente** (Teste, dia 23) |
| Emissão Focus (fiscal) | `emit-nf`, `focus-nfe-webhook`, RPCs | 10 NFs `emitida` via Focus em prod |
| Lote NF | `app.notas-fiscais.tsx` | Seções "A emitir" + "Aguardando Focus" |
| Sync destinatário NF | `20260723160000_fix_resolver_destinatario_nf_v_conv.sql` | Fix join convênio |
| Cobranças sem NF + CPF/tel | `20260723170000_cobrancas_sem_nf_paciente_contato.sql` | RPC enriquecida para UI |

## Integrações (prod) — verificado 23/07

- `CORA_AUTO_NF_ENABLED` = ativo
- `CRON_SECRET` = configurado (crons NF + boleto agendados)
- `N8N_WEBHOOK_NF_EMAIL` = configurado
- `N8N_WEBHOOK_BOLETO_DOCS` = configurado
- `FOCUSNFE_WEBHOOK_SECRET` = configurado
- Cora em **stage** (mTLS)

## Testes feitos hoje

1. **Boleto data específica (Teste):** cobrança Jul/2026 criada, boleto Cora emitido, n8n OK.
2. **Marcar pago manual:** NF não saía → corrigido com `auto-nf-apos-pagamento`. NF Teste `51648eb4-…` enviada à Focus (`processando_autorizacao`).
3. **Lote NF:** fix PGRST201 em `emit-nf` (join fisioterapeuta ambíguo).
4. **Bug UI:** import duplicado `supabase` em `cobrancas.ts` — corrigido.

## Pendências operacionais (não código)

1. **Cadastro em massa:** CPF/CNPJ + telefone nos pacientes de Jun/2026 "A emitir" (8 sem doc).
2. **Modo data específica:** definir dia NF/boleto nos pacientes reais (hoje só Teste no boleto).
3. **Cutover Focus produção** — alinhar com Diego (`docs/perguntas_diego_fiscal.md`).
4. **E-mail NF:** dispara após webhook Focus **autorizado** (não no pagamento). Conferir n8n end-to-end.
5. **Pagamento real Cora** vs manual — ambos disparam NF; validar webhook com boleto pago de verdade.

## Comandos úteis

```bash
# Deploy edge functions
python scripts/deploy_supabase_function.py auto-nf-apos-pagamento emit-nf --no-verify-jwt
python scripts/deploy_supabase_function.py boleto-emissao-data-especifica emit-boleto-cora send-boleto-cobranca --no-verify-jwt

# Migration
python scripts/apply-migration-sql.py supabase/migrations/20260723180000_boleto_emissao_data_especifica.sql

# Testes
python scripts/test_nf_remediacao.py
python scripts/test_cobrancas_sem_nf.py
```

## Paciente / cobrança de teste

- Paciente: **Teste** (`f4da1fb0-40f0-49e7-91d5-575ea865cbe0`)
- `modo_emissao_boleto = data_especifica`, dia **23**, valor R$ 150
- Cobrança Jul/2026: `f0712f33-3249-4bf7-aef7-11948f86bb56` (pago manual)
- NF: `51648eb4-fe26-4c63-909a-a49af06e4d4c` (Focus processando)

## Arquivos principais tocados

- Frontend: `app.notas-fiscais.tsx`, `app.pacientes.index.tsx`, `app.cobrancas.tsx`, `cobrancas.ts`, `notas-fiscais.ts`, `pacientes.ts`
- Edge: `auto-nf-apos-pagamento`, `boleto-emissao-data-especifica`, `_shared/auto-nf-after-paid.ts`, `cora-payment-sync.ts`, `emit-nf/index.ts`
- Migrations: `20260723160000`, `20260723170000`, `20260723180000`
