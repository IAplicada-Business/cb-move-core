# Regras Fiscais CB MOVE Neuroscience

## LogJur — Estrutura da Planilha

O arquivo "Planilha Padrão LogJur" controla o faturamento de convênios/seguradoras.
O CSV exportado (aba "Logjur") tem as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| CARTÃO DO SEGURADO | Número do cartão do plano (ex: 952 650 037766 00 8) |
| TIPO DE GUIA | SADT / HM / HP |
| PEND CHECKLIST | Pendências para emissão |
| SENHA | Senha de autorização do convênio |
| e-mail Recebimento Fase do Recibo | E-mail para envio |
| PRORROGACAO | Indicador de prorrogação da autorização |
| NOTA FISCAL/RECIBO | Número da NF ou recibo |
| NOME DO ARQUIVO | Nome do PDF vinculado |
| DT EMISSÃO NF | Data de emissão |
| VALOR DA NF | Valor da NF |
| Matrícula | Matrícula do segurado |
| Observação 1/2 | Campos livres |
| PRESTADOR DE SERVIÇO | Nome da clínica |
| CNPJ DO PRESTADOR DE SERVIÇO | CNPJ |

**Tipos de guia:**
- SADT = Serviço Auxiliar de Diagnóstico e Terapêutica (ambulatorial padrão)
- HM = ⚠️ CONFIRMAR COM DIEGO
- HP = ⚠️ CONFIRMAR COM DIEGO

**Macros VBA:** ⚠️ PENDENTE — Diego/Charlene fornecer o .xlsm para análise das macros VBA

---

## Tipos de Paciente e Regras de Emissão de NF

### Particular
- Destinatário da NF: o próprio paciente (nome + CPF)
- Plano: Mensalista ou Por Sessão
- Forma de pagamento: boleto Cora, PIX/depósito
- Template: RQ.GPS.07.001

### Convênio (Unimed, Bradesco Saúde, CCG)
- Destinatário: o convênio (nome + CNPJ)
- Faturamento via SADT (guia LogJur)
- Template: RQ.GPS.07.002
- ⚠️ CONFIRMAR COM DIEGO: valor faturado = total sessões ou por sessão × qtd?
- ⚠️ CONFIRMAR COM DIEGO: o que é "SHAREPOINT" na coluna SITUAÇÃO?

### Judicial — Bradesco Seguros
- Destinatário: Bradesco Seguros (CNPJ)
- Corpo: nome + CPF do paciente + número do processo + sessões realizadas
- Template: RQ.GPS.07.003
- Forma de pagamento: alvara_judicial
- ⚠️ CONFIRMAR COM DIEGO: sessões recuperadas (RC) entram no corpo?

### Judicial — CCG / Unimed com processo
- ⚠️ CONFIRMAR COM DIEGO: usa template convênio (07.002) ou judicial (07.003)?

### PUC
- Destinatário: PUCRS (CNPJ)
- ⚠️ CONFIRMAR COM DIEGO: template próprio ou usa particular?

---

## Regras de Cobrança

### Mensalista
- Valor fixo: R$ 1.028,00/mês (simples)
- Duplo/Triplo: ⚠️ CONFIRMAR fator multiplicador

### Por Sessão
- Valor padrão: R$ 266,00/sessão (simples)
- Sessão dupla: R$ 532,00 (ex.: Diego Pereira Agnes)
- ⚠️ CONFIRMAR tabela completa de valores por tipo

### Sessões cobráveis
- Cobráveis: P (presente), F (falta sem justificativa), RC (recuperada)
- Não cobráveis: FJ, NJ, NR

---

## Formas de Pagamento — Inferência de SITUAÇÃO

| SITUAÇÃO contém | forma_pagamento |
|-----------------|-----------------|
| "BOLETO", "Boleto para dia X" | boleto |
| "PIX" | transferencia |
| "depósito" | deposito |
| "judicial", "alvará" | alvara_judicial |
| "SHAREPOINT", "convênio" | convenio_direto |
| vazio / outro | deposito (padrão) |

---

## Status — Inferência de SITUAÇÃO

| SITUAÇÃO contém | status |
|-----------------|--------|
| "pago", "PAGO BOLETO", "Pago" | pago |
| "atrasado", "Pagamento atrasado" | atrasado |
| "vai faltar", "falta pagar" | pendente |
| "referente a [mês anterior]" | regularizar_retroativa |
| "SHAREPOINT referente a [mês]" | aguardando_convenio |
| "judicial", "alvará" | aguardando_alvara |
| "sem cobrança" | ignorar (não importar) |
| vazio / outro texto livre | pendente |

---

## Vencimento — Inferência de SITUAÇÃO

| SITUAÇÃO contém | Dia de vencimento |
|-----------------|-------------------|
| "dia 5" / "dia 05" | 05 do mês |
| "dia 10" | 10 do mês |
| "dia 15" / "sempre p/ dia 15" | 15 do mês |
| "dia 25" / "sempre p/ dia 25" | 25 do mês |
| sem indicação | 15 do mês (padrão) |

---

## Conciliação Extrato Bradesco

- Match por valor ± R$ 0,01
- Match por data ± 5 dias úteis do vencimento
- Confirmação manual antes de atualizar status → pago
- ⚠️ CONFIRMAR COM DIEGO: como identificar pagador pelo extrato?

---

## Safe Notas / Resend

- ⚠️ PENDENTE: credenciais Safe Notas e Resend
- PDF: Storage 'notas-fiscais' → nf/{ano}/{numero}.pdf
