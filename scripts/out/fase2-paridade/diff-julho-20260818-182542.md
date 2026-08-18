# Diff paridade — JULHO/2026

Gerado: `2026-08-18T18:25:42.959007Z`

## Headers vs canônico (extrato CB MOVE)

- Status: **ok**
- Drive: `['Nome do Paciente', 'Avaliação', 'Frequência', 'Dias da Semana', 'Nº Sessões', 'Plano', 'R$ Sessão/Mês', 'R$ Previsto', 'R$ Recebido', 'SITUAÇÃO']`
- Faltando: `[]`
- Extra: `[]`

## Contagem de células

| Status             | Qtd |
| ------------------ | --- |
| ok                 | 9   |
| diverge            | 7   |
| ausente no sistema | 8   |
| ausente no Drive   | 0   |

Linhas Drive: **3** · Sistema: **2** · API: sim

## Divergências (não-ok)

| Paciente                              | Campo          | Drive                                                              | Sistema                    | Status          |
| ------------------------------------- | -------------- | ------------------------------------------------------------------ | -------------------------- | --------------- |
| Airton Tonelo                         | Frequência     | 2x semana triplo                                                   | None                       | ausente_sistema |
| Airton Tonelo                         | Dias da Semana | 2ª e 5ª (triplos)                                                  | None                       | ausente_sistema |
| Airton Tonelo                         | Nº Sessões     | None                                                               | None                       | ausente_sistema |
| Airton Tonelo                         | Plano          | Por Sessão                                                         | None                       | ausente_sistema |
| Airton Tonelo                         | R$ Sessão/Mês  | R$ 266,00                                                          | None                       | ausente_sistema |
| Airton Tonelo                         | R$ Previsto    | None                                                               | None                       | ausente_sistema |
| Airton Tonelo                         | R$ Recebido    | None                                                               | None                       | ausente_sistema |
| Airton Tonelo                         | SITUAÇÃO       | Vai faltar 12236,00 referente abril, 10.640,00 referente a maio.   | None                       | ausente_sistema |
| Amanda Pavan                          | R$ Sessão/Mês  | R$ 266,00                                                          | 287.0                      | diverge         |
| Amanda Pavan                          | R$ Recebido    | None                                                               | 2128.0                     | diverge         |
| Amanda Pavan                          | SITUAÇÃO       | None                                                               | PAGO                       | diverge         |
| Kayhan Bustamante Prestes da Silveira | R$ Sessão/Mês  | R$ 266,00                                                          | 287.0                      | diverge         |
| Kayhan Bustamante Prestes da Silveira | R$ Previsto    | 15960.0                                                            | 4522.0                     | diverge         |
| Kayhan Bustamante Prestes da Silveira | R$ Recebido    | Valor duplicado 42.560,00 referente 09/2025 a 01/2026              | None                       | diverge         |
| Kayhan Bustamante Prestes da Silveira | SITUAÇÃO       | PAGAMENTO REFERENTE 052026-01/07- 9.044,00, 062026-17/07- 6.916,00 | PAGAMENTO REFERENTE 052026 | diverge         |

## Auditoria de headers — todas as abas

- **AGOSTO**: ok · missing=[] · extra=[]
- **JULHO**: ok · missing=[] · extra=[]
- **JUNHO**: ok · missing=[] · extra=[]
- **MAIO**: ok · missing=[] · extra=[]
- **ABRIL**: ok · missing=[] · extra=[]
- **MARÇO**: ok · missing=[] · extra=[]
- **FEVEREIRO**: ok · missing=[] · extra=[]
- **JANEIRO**: ok · missing=[] · extra=[]
