# Regras Fiscais CB MOVE Neuroscience

## Tipos de paciente e regras de emissão de NF

### Particular
- Destinatário da NF: o próprio paciente (nome + CPF do paciente)
- Corpo da NF: sem campos adicionais
- Template: RQ.GPS.07.001

### Convênio (Unimed, Bradesco, CCG)
- Destinatário da NF: o convênio (nome + CNPJ do convênio)
- Corpo da NF: sem campos adicionais obrigatórios
- Template: RQ.GPS.07.002
- ⚠️ REGRA A CONFIRMAR COM DIEGO: valor faturado ao convênio = valor total das sessões ou valor por sessão × qtd?

### Judicial — Bradesco Seguros
- Destinatário da NF: Bradesco Seguros (CNPJ do convênio)
- Corpo da NF: paciente + CPF + número do processo judicial + sessões realizadas
- Template: RQ.GPS.07.003
- ⚠️ REGRA A CONFIRMAR COM DIEGO: inclui sessões recuperadas (RC) no corpo?

### Judicial — Centro Clínico Gaúcho (CCG)
- Destinatário da NF: Centro Clínico Gaúcho (CNPJ)
- Corpo da NF: paciente + CPF + processo
- ⚠️ REGRA A CONFIRMAR COM DIEGO: CCG usa mesmo template que Bradesco ou tem específico?

### Judicial — Unimed (convenio direto com processo)
- Destinatário: Unimed
- ⚠️ REGRA A CONFIRMAR COM DIEGO: usa template convênio (07.002) ou judicial (07.003)?

### PUC
- Destinatário: PUCRS (CNPJ da universidade)
- ⚠️ REGRA A CONFIRMAR COM DIEGO: template próprio ou usa particular?

## Regras de cobrança

### Mensalista
- Valor fixo mensal independente do número de sessões
- Frequência não afeta o valor cobrado
- NF emitida mensalmente

### Por sessão
- Valor = qtd_sessoes_cobráveis × valor_sessao
- Sessões cobráveis: P (presente), F (falta sem justificativa), RC (recuperada)
- Não cobram: FJ (falta justificada), NJ (não justificada pendente), NR (sem atendimento)

## Formas de pagamento
- boleto: emitido via Cora API
- deposito: depósito bancário — conciliar pelo extrato Bradesco
- transferencia: PIX/TED — conciliar pelo extrato Bradesco
- alvara_judicial: pagamento via alvará — aguardar liberação judicial
- convenio_direto: pago diretamente pelo convênio

## Status de cobrança
- pendente: aguardando vencimento
- pago: confirmado recebido
- vencido: passou do vencimento sem pagamento
- atrasado: vencido há mais de 30 dias (⚠️ CONFIRMAR COM DIEGO diferença exata de vencido vs atrasado)
- aguardando_convenio: enviado ao convênio, aguardando repasse
- aguardando_alvara: processo judicial — aguardando liberação do alvará
- regularizar_retroativa: cobrança de competência passada a regularizar
- cancelado: cobrança cancelada

## Extrato Bradesco — Regras de conciliação
- Match por valor ± R$ 0,01 (tolerância de centavo)
- Match por data: pago_em dentro de ± 5 dias úteis do vencimento
- ⚠️ REGRA A CONFIRMAR COM DIEGO: como identificar o pagador pelo extrato? (nome, CPF, ref?)
- Após match confirmado pelo usuário: atualiza status='pago' e pago_em=data_do_deposito

## Safe Notas — Integração
- ⚠️ REGRA A CONFIRMAR COM DIEGO/CHARLENE: endpoint e autenticação da Safe Notas
- PDF salvo em Storage 'notas-fiscais' com path: nf/{ano}/{numero}.pdf
- Email enviado via Resend após emissão

## LogJur — Macro VBA (a documentar quando o arquivo for fornecido)
- ⚠️ PENDENTE: Diego ou Charlene fornecerão o arquivo LogJur.xlsm para análise
- Funções VBA a documentar: [aguardando arquivo]
