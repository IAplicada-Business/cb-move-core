# Checklist — Cutover Produção Focus + Cora

Use este checklist **somente após** Fase 1 de homologação concluída e aprovação fiscal (Diego/Charlene).

## Pré-requisitos (Fase 1 homologação)

- [ ] Retry NF no `cora-payment-sync` (cobrança já paga + NF pré-existente)
- [ ] Guard `modo_emissao_nf` no fluxo Cora
- [ ] Cron `nf-emissao-data-especifica` dispara `emit-nf`
- [ ] RPCs financeiros restritos (`assert_finance_or_service_role`)
- [ ] Webhooks fail-closed (`FOCUSNFE_WEBHOOK_SECRET`, `CORA_WEBHOOK_SHARED_SECRET`)
- [ ] Portal paciente NF corrigido
- [ ] Testes: `deno test focus-nfe.test.ts`, `python scripts/test_nf_remediacao.py`, `python scripts/test_cora_nf_automatica_e2e.py`

## Focus NFe — produção

- [ ] Token **produção** da empresa no painel Focus (Empresas → Tokens → Produção)
- [ ] `FOCUSNFE_AMBIENTE=producao` em `integracao_config`
- [ ] `FOCUSNFE_TOKEN` atualizado para token produção
- [ ] Certificado A1 válido no painel Focus
- [ ] NFS-e Nacional habilitada em produção (`habilita_nfsen_producao`)
- [ ] Webhook Focus produção registrado → `focus-nfe-webhook`
- [ ] `FOCUSNFE_WEBHOOK_SECRET` configurado (header `X-Webhook-Secret`)
- [ ] **Não** configurar `FOCUSNFE_INSCRICAO_MUNICIPAL` (POA rejeita E0120)
- [ ] `FOCUSNFE_SIMPLES_NACIONAL=3` (ME/EPP)
- [ ] `FOCUSNFE_PERCENTUAL_TRIBUTOS_SN` confirmado com contador
- [ ] Emissão de teste descartável em produção (1 NF real, depois cancelar se aplicável)

## Cora — produção

- [ ] Credenciais mTLS **produção** (cert + key + client_id)
- [ ] `CORA_API_BASE` apontando para API produção (não stage)
- [ ] Webhook produção registrado com `?secret=` (`CORA_WEBHOOK_SHARED_SECRET`)
- [ ] `CORA_WEBHOOK_ENDPOINT_ID` atualizado
- [ ] Teste E2E: boleto real mínimo → pagamento → NF automática

## n8n / e-mail

- [ ] `N8N_WEBHOOK_NF_EMAIL` ativo
- [ ] `N8N_WEBHOOK_SECRET` configurado
- [ ] Workflow publicado (`docs/n8n/SETUP_NF_EMAIL.md`)
- [ ] (Opcional Fase 2) PDF anexo + Resend

## Operacional

- [ ] `CORA_AUTO_NF_ENABLED` documentado (kill switch)
- [ ] Respostas cliente em `docs/perguntas_cora_nf_automatica.md`
- [ ] Regras fiscais fechadas em `docs/regras_fiscais.md`
- [ ] UI financeiro monitora erros em `cobrancas_pagamentos_eventos`

## Rollback

- [ ] `CORA_AUTO_NF_ENABLED=false` — para auto-NF no pagamento
- [ ] Reverter `FOCUSNFE_AMBIENTE=homologacao` se necessário
- [ ] Emissão manual continua disponível em `/app/notas-fiscais`
