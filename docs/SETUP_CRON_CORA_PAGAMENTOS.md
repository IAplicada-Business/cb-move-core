# Cron — verificação de pagamentos Cora (automação de NF)

Edge Function: `cora-verificar-pagamentos`
Núcleo: `_shared/cora-payment-sync.ts` (`syncPagamentosCoraPendentes`)

Varre `cobrancas` com `status IN ('pendente','atrasado')`, `boleto_modo = 'automatico'` e
`cora_invoice_id IS NOT NULL`, confirma o status real de cada boleto via `GET /v2/invoices/{id}`
(mTLS) e, se `PAID`: marca a cobrança como `pago`, cria a NF (`criar_nf_de_cobranca`) e chama
`emit-nf` internamente. Complementa o webhook (`cora-webhook`) como rede de segurança — mesmo
que o webhook falhe ou chegue antes da liquidação real, este cron garante que o pagamento seja
capturado dentro do intervalo agendado.

`CRON_SECRET` já está configurado em `integracao_config` (mesmo secret usado por
`atualizar-cobrancas-vencidas` — pode reaproveitar).

## 1. Agendar no Supabase Dashboard

1. [Dashboard → Edge Functions](https://supabase.com/dashboard/project/grlkbtnwvxorlfglyzid/functions)
2. Abra `cora-verificar-pagamentos` → **Schedules** (ou Cron)
3. Nova schedule:
   - **Cron:** `*/15 * * * *` (a cada 15 min — ajuste para `*/30` se preferir menos chamadas à Cora)
   - **Método:** `POST`
   - **Header:** `x-cron-secret: <CRON_SECRET>`

## 2. Teste manual

```bash
curl -X POST \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://grlkbtnwvxorlfglyzid.supabase.co/functions/v1/cora-verificar-pagamentos
```

Resposta esperada:

```json
{"ok":true,"verificadas":5,"pagas":0,"resultados":[...]}
```

## 3. Kill switch (emissão automática de NF)

`CORA_AUTO_NF_ENABLED` em `integracao_config` (já configurada como `true`). Definir como `"false"`
desliga só a emissão automática da NF — a cobrança ainda é marcada `pago` normalmente
(comportamento decidido na arquitetura: nunca deixar uma cobrança "travada" como pendente só
porque a automação de NF está pausada).

## 4. Webhook (baixa latência, opcional)

`cora-webhook` já está registrado na Cora Stage (`CORA_WEBHOOK_ENDPOINT_ID` em
`integracao_config`, criado via `scripts/register-cora-webhook.py`). Ele dispara a mesma
sincronização assim que a Cora notifica `invoice.paid`, sem esperar o próximo ciclo do cron.
Achado do teste E2E: a notificação da Cora pode chegar 1–2 min antes de `GET /v2/invoices/{id}`
já refletir `PAID` (liquidação assíncrona) — por isso o cron acima continua necessário como
garantia, o webhook é só uma otimização de latência.

## 5. Checklist pós-deploy

- [x] Migration `20260716120000_cora_pagamento_automatico.sql` aplicada
- [x] Functions deployadas: `cora-verificar-pagamentos`, `cora-webhook`, `emit-nf`, `emit-boleto-cora`
- [x] `CRON_SECRET`, `CORA_AUTO_NF_ENABLED`, `CORA_WEBHOOK_SHARED_SECRET`, `CORA_WEBHOOK_ENDPOINT_ID` em `integracao_config`
- [x] Webhook registrado na Cora Stage (`invoice.paid` → `cora-webhook`)
- [x] Teste E2E completo (`scripts/test_cora_nf_automatica_e2e.py`): boleto criado → pago (API de teste Stage) → cobrança marcada `pago` → NF criada → `emit-nf` disparado (erro esperado por paciente de teste sem CEP — ver nota abaixo)
- [x] Testes complementares (`scripts/test_cora_nf_automatica_extra.py`) — ver resultado detalhado abaixo
- [ ] Schedule ativa no Dashboard (`*/15 * * * *`) — **pendente, fazer manualmente no Dashboard**

### Nota sobre o teste E2E

O teste usou 2 pacientes/cobranças sintéticos ("TESTE AUTOMACAO CORA - APAGAR", removidos ao
final). O pagamento e a marcação `pago` + criação de NF funcionaram normalmente; a chamada a
`emit-nf` retornou erro da Focus NFe (`Missing child element CEP/xLgr`) porque o paciente de
teste não tinha endereço cadastrado — isso é esperado (pacientes reais têm endereço). O que
importa: a automação chegou até o ponto de tentar emitir a NF via `emit-nf` (autenticação
servidor-a-servidor funcionando) e registrou o erro corretamente em
`cobrancas_pagamentos_eventos` sem deixar nada em estado inconsistente.

### Testes complementares (2026-07-16, `scripts/test_cora_nf_automatica_extra.py`)

Fecham as lacunas que o E2E inicial não cobriu. Todos com dados sintéticos descartáveis, removidos ao final.

1. **Segurança `boleto_modo='manual'`** — PASSOU. Cobrança marcada `manual` com um `cora_invoice_id`
   real e pago não é tocada pelo polling (não aparece na varredura, permanece `pendente`). Confirma
   que boletos colados à mão nunca acionam a automação (pergunta 5/8 do cliente).
2. **Kill switch `CORA_AUTO_NF_ENABLED=false`** — PASSOU. Com a flag desligada, a cobrança é marcada
   `pago` normalmente mas nenhuma NF é criada. Religada em seguida.
3. **Webhook isolado** — PASSOU. Chamando `cora-webhook` diretamente (headers `webhook-event-id`,
   `webhook-event-type: invoice.paid`, `webhook-resource-id`) *sem* nenhuma chamada de polling
   envolvida, a cobrança é marcada `pago` e a NF é criada — confirma que o caminho do webhook
   funciona de ponta a ponta por si só, não só como complemento do polling.
4. **Caminho feliz — NF realmente aceita pela Focus (homologação)** — **PASSOU, após corrigir um bug
   pré-existente descoberto por este teste** (fora do escopo original da automação Cora, mas corrigido
   na mesma sessão a pedido do usuário). Achado + correção:

   - **Causa raiz confirmada**: consultei as NFs reais já emitidas via Focus (`fiscal_provider =
     'focus_nfe'`) e são *todas* da mesma paciente (Amanda Pavan) — cujo CPF é a única entrada
     hardcoded em `TOMADOR_CATALOG_BY_CPF` com endereço completo. Todas as demais NFs reais no banco
     (convênios e outros particulares) são `fiscal_provider = 'drive_import'` (importadas de emissão
     manual anterior) — ou seja, **nenhuma NF de convênio jamais tinha sido emitida com sucesso pela
     Focus** até este teste, e nenhum particular fora do catálogo hardcoded teria funcionado.
   - **Bug 1** (`emit-nf/index.ts::resolveTomador`): para tomador `particular`, só repassava
     e-mail/telefone do paciente para a Focus — nunca o endereço, mesmo já existindo colunas
     `pacientes.endereco/numero_endereco/complemento/bairro/cep/cidade/uf/codigo_municipio_ibge`.
   - **Bug 2** (`convenios` / `_shared/focus-nfe-tomador-catalog.ts`): a tabela `convenios` só tinha
     `endereco` como texto único (ex.: "AV RIO DE JANEIRO, 555, SAL 801-SAL 1701, CAJU"), sem um campo
     separado para o número — mas o schema da NFS-e Nacional exige o número (`nro`) como elemento
     XML próprio, não misturado no logradouro (rejeitado com 422 se ausente).
   - **Correção aplicada**: migration `20260716130000_endereco_tomador_completo.sql` (colunas
     `numero`/`complemento`/`bairro` em `convenios`); `_shared/focus-nfe-tomador-catalog.ts` (os 7
     convênios reais do catálogo agora têm `numero`/`complemento`/`bairro` separados); `emit-nf/index.ts`
     agora repassa o endereço completo do paciente para tomador `particular` e busca
     `numero/complemento/bairro` do convênio também. `emit-nf` redeployado.
   - **Validado**: reexecutei o teste com um convênio sintético com endereço completo (incluindo
     `numero`) → Focus aceitou (`status: processando`, sem erro).
   - **Atenção/ação recomendada**: os 7 convênios reais no catálogo hardcoded (Bradesco, Centro
     Clínico Gaúcho, Unimed POA, GEAP, IPERGS, Unimed Vitória, Doctor Clin) já têm `numero` correto
     via catálogo — não precisam de ação. Mas **convênios cadastrados no banco que não estão nesse
     catálogo** (se algum existir/for criado) precisam ter `convenios.numero` preenchido para emitir
     via Focus com sucesso; e **pacientes particulares** precisam ter `pacientes.numero_endereco`
     preenchido (não só `endereco`) para o mesmo motivo.
