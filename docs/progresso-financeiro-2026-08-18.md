# Progresso — melhorias financeiro (18/08/2026)

## Entregue nesta sessão

| Item                                      | Status | Onde                                                         |
| ----------------------------------------- | ------ | ------------------------------------------------------------ |
| PDF consolidado IR (`pdf-lib`)            | ✅     | `supabase/functions/_shared/pdf-ir.ts`, `gerar-relatorio-ir` |
| Portal baixa PDF (com ano)                | ✅     | `portal.notas-fiscais.tsx`                                   |
| Sub-aba IR em Análises                    | ✅     | `RelatorioIrPanel` em `/app/financeiro`                      |
| Painel inline conciliação                 | ✅     | `PainelConciliacaoInline` + sessionStorage                   |
| Fixtures Bradesco + matcher ±5 dias úteis | ✅     | `src/lib/fixtures/*`, `extrato-parser.ts`                    |
| Gancho paridade colunas extrato           | ✅     | `extrato-financeiro.parity.test.ts`                          |

## Ainda depende do cliente / operação

1. **Smoke NF produção** — 1 emissão real pós-cutover Focus
2. **Extratos Bradesco reais** — ver `docs/EXTRATOS_BRADESCO_AMOSTRAS.md`
3. ~~**Fase 2b diff visual**~~ — feito em `docs/fase2-paridade-relatorios-2026-08-18.md` (gaps Kayhan/Airton = dados)
4. Deploy da edge `gerar-relatorio-ir` — **publicado v33** (18/08)

## Deploy necessário

```bash
supabase functions deploy gerar-relatorio-ir --project-ref grlkbtnwvxorlfglyzid
```
