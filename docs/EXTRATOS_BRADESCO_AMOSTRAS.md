# Extratos Bradesco — amostras para validar matching

O matcher automático vive em `src/lib/extrato-parser.ts` (CSV `Data;Histórico;Valor` e OFX).

## Fixtures sintéticas (repo)

| Arquivo                                         | Uso                         |
| ----------------------------------------------- | --------------------------- |
| `src/lib/fixtures/extrato-bradesco-exemplo.csv` | Formato CSV típico Bradesco |
| `src/lib/fixtures/extrato-bradesco-exemplo.ofx` | OFX mínimo com 2 créditos   |

Cobertos por `src/lib/extrato-parser.test.ts`.

## Ainda falta (cliente)

Para fechar a subtarefa do board, pedir à CB MOVE:

1. **1–2 extratos reais** exportados do Internet Banking Bradesco (CSV e/ou OFX), com dados mascarados se necessário
2. Confirmar com Diego: **como identificar o pagador** pelo histórico (hoje o match é só valor ± R$ 0,01 e ± 5 dias úteis do vencimento)
3. Guardar cópias em `scripts/drive_import/extratos-bradesco/` (não versionar dados sensíveis sem anonimizar)

## Regra de match (atual)

- Valor ± R$ 0,01
- Data ± **5 dias úteis** do vencimento
- Confiança: ≤1 dia útil = alta · ≤3 = média · ≤5 = baixa
- Confirmação manual antes de marcar como pago
