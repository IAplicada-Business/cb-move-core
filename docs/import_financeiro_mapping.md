# Mapeamento: Relatório Financeiro 2026 → Schema CB MOVE

## Estrutura do arquivo

- **Arquivo:** Relatório Financeiro 2026.xlsx
- **Abas:** JANEIRO, FEVEREIRO, MARÇO, ABRIL, MAIO, JUNHO (uma por mês de 2026)
- **Linha 0:** data serial do mês (número Excel)
- **Linha 1:** cabeçalhos (Nome do Paciente, Avaliação, ...)
- **Linhas 2+:** dados dos pacientes

## Colunas e mapeamento

| Idx | Coluna Planilha  | Campo DB             | Tabela    | Notas                                                  |
| --- | ---------------- | -------------------- | --------- | ------------------------------------------------------ |
| 0   | Nome do Paciente | nome                 | pacientes | Match fuzzy ≥ 85%                                      |
| 1   | Avaliação        | criado_em (info)     | —         | Serial Excel → data; apenas informativo                |
| 2   | Frequência       | observacoes (info)   | cobrancas | "2x semana simples"                                    |
| 3   | Dias da Semana   | observacoes (info)   | cobrancas | "2ª e 5ª (simples)"                                    |
| 4   | Nº Sessões       | qtd_sessoes          | cobrancas | Frequentemente vazio → null                            |
| 5   | Plano            | regime               | cobrancas | "Mensalista" → mensalista \| "Por Sessão" → por_sessao |
| 6   | R$ Sessão/Mês    | —                    | —         | Apenas referência; valor real = R$ Previsto            |
| 7   | R$ Previsto      | valor                | cobrancas | Número; vazio = R$ 0 (alerta)                          |
| 8   | R$ Recebido      | —                    | —         | Informativo; pago_em inferido de SITUAÇÃO              |
| 9   | SITUAÇÃO         | status + observacoes | cobrancas | Campo livre; ver regras abaixo                         |

## Campos calculados / inferidos

| Campo DB        | Como calcular                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| competencia_mes | Número da aba (JUNHO → 6, MAIO → 5, ...)                                                                                           |
| competencia_ano | 2026 (todas as abas)                                                                                                               |
| tipo            | "particular" (padrão); "judicial" se SITUAÇÃO contém "judicial"\|"alvará"; "convenio" se "SHAREPOINT"\|"convênio"\|"Unimed"\|"CCG" |
| forma_pagamento | Ver tabela de inferência em regras_fiscais.md                                                                                      |
| status          | Ver tabela de inferência em regras_fiscais.md                                                                                      |
| vencimento      | Dia extraído de SITUAÇÃO ("dia 15") ou padrão 15 do mês                                                                            |
| servico         | "Fisioterapia Neurológica" (padrão)                                                                                                |
| observacoes     | "migrado_logjur \| [SITUAÇÃO original]"                                                                                            |

## Tipo → regime mapping

| Planilha   | regime (enum)                                      |
| ---------- | -------------------------------------------------- |
| Mensalista | mensalista                                         |
| Por Sessão | por_sessao                                         |
| - / vazio  | mensalista (padrão)                                |
| *****      | mensalista (padrão — linhas de cabeçalho de grupo) |

## Linhas a ignorar

- Linha com Nome vazio ou menos de 3 caracteres
- Linha com Nome = "Nome do Paciente" (linha de cabeçalho repetida)
- Linha com SITUAÇÃO = "sem cobrança"
- Linha com Plano = "*****" (separador de grupo)
- Linha com Plano = "-" sem valor previsto

## Totais por aba (estimados)

| Aba       | Pacientes      | R$ Previsto total | Observações                 |
| --------- | -------------- | ----------------- | --------------------------- |
| JUNHO     | 107            | R$ 340.501,03     | Aba mais recente            |
| MAIO      | 109            | R$ 586.293,39     | Alto: inclui retroativos    |
| ABRIL     | 122            | R$ 20.957,00      | Baixo: muitos campos vazios |
| MARÇO     | 113            | R$ 18.789,06      |                             |
| FEVEREIRO | 114            | R$ 1.801,06       | Muitos campos vazios        |
| JANEIRO   | 129            | R$ 1.988,62       |                             |
| **TOTAL** | **694 linhas** | —                 | ~142 pacientes únicos       |

## Alertas conhecidos

1. **25 linhas com valor vazio em JUNHO** — ex.: Airton Tonelo, Alzira Miller Scherer, Claudia Gil Barella
2. **SITUAÇÃO é texto livre** — parser regex pode errar; sempre revisar o dry-run
3. **Pacientes sem CPF** — a planilha não tem coluna CPF; pacientes serão criados sem CPF (preencher depois no painel)
4. **Tipo "SHAREPOINT"** — ⚠️ CONFIRMAR COM DIEGO o que significa
5. **Airton Tonelo tem 2 linhas** — frequência "triplo" + "duplo" (2 períodos de atendimento); serão 2 cobranças separadas
6. **Valores mesclados formato** — alguns como "R$ 266,00", outros como número puro 266
