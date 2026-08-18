# Fase 2b — Paridade visual célula a célula (Drive × sistema)

**Data:** 18/08/2026  
**Fonte Drive:** `Relatório Financeiro 2026` (`scripts/download_drive_files.py` → `scripts/drive_import/relatorio_financeiro_2026.xlsx`)  
**Ferramenta:** `scripts/diff_paridade_extrato_drive.py`  
**Artefato:** `scripts/out/fase2-paridade/LATEST.md`

## Escopo desta entrega

Diff **célula a célula** da planilha master financeira vs extrato/cobranças do CB MOVE — amostras Airton / Amanda / Kayhan em **JULHO/2026**, mais auditoria de headers em todas as abas.

Relatórios de atendimento (PDF Unimed/SharePoint) já têm renderizadores distintos (sessão 27/07); o gap restante de layout visual vs PDFs assinados do Drive continua operacional (gerar na UI e comparar).

## Headers (todas as abas)

| Aba     | Paridade vs canônico extrato CB MOVE                                            |
| ------- | ------------------------------------------------------------------------------- |
| JAN–JUL | **ok** (10 colunas iguais)                                                      |
| AGOSTO  | **ok** após alias `R$ Referente` → `R$ Previsto` (Drift do cliente na planilha) |
| JANEIRO | `Previsto` sem `R$` — normalizado no script                                     |

Canônico (`EXTRATO_COLUNAS`): Nome, Avaliação, Frequência, Dias, Nº Sessões, Plano, R$ Sessão/Mês, R$ Previsto, R$ Recebido, SITUAÇÃO.

## Amostras JULHO/2026 — matriz

| Paciente              | Resultado             | Detalhe                                                                                                                                                                            |
| --------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Airton Tonelo**     | 🔴 ausente no sistema | Linha no Drive sem R$ Previsto; **sem cobrança Jul/2026** no banco (já notado em `progresso-sessao-2026-07-27`)                                                                    |
| **Amanda Pavan**      | 🟡 parcial            | Frequência/dias/plano/previsto **ok** (R$ 2.128). Diverge: sessão Drive R$ 266 vs cadastro R$ 287; Drive sem “Recebido” e SITUAÇÃO vazia, sistema `pago` → exporta R$ 2.128 / PAGO |
| **Kayhan Bustamante** | 🔴 diverge valores    | Frequência/dias/plano ok. Previsto Drive **15.960** vs sistema **4.522**; sessão 266 vs 287; SITUAÇÃO/Recebido Drive com textos livres de pagamento parcelado                      |

Contagem amostra (script): **9 ok · 7 diverge · 8 ausente_sistema**.

## Interpretação (não é bug de layout)

1. **Headers do extrato exportado** estão alinhados à master — B2/B1 (xlsx) fechados no código.
2. Divergências de **valor sessão 266→287** = atualização de preço no cadastro, não colunas erradas.
3. **Kayhan / Airton** = gaps de **dados/migração**, não de template XLSX.
4. Coluna SITUAÇÃO no Drive é texto livre; o sistema normaliza status quando a observação migrada vem vazia (`migrado_logjur |`).

## Como repetir

```bash
python3 scripts/download_drive_files.py
# exportar cobranças do mês (service role) OU usar JSON de amostra versionado
python3 scripts/diff_paridade_extrato_drive.py --mes JULHO --amostra \
  --sistema-json scripts/out/fase2-paridade/sistema-julho-amostras.json
```

## Backlog que permanece (dados / operação)

- [ ] Criar/ajustar cobrança Jul Airton (ou marcar linha Drive como sem cobrança)
- [ ] Conferir com cliente o previsto Kayhan (15.960 vs 4.522 / 9.044 da planilha)
- [ ] Diff visual PDF atendimento Amanda Abr/2026 Unimed (gerar na UI × PDF Drive)
- [ ] Export LogJur (.xlsm) — Fase 3

## Checklist board “Paridade Fase 2”

- [x] Script de diff célula a célula vs Drive
- [x] Headers validados em todas as abas 2026
- [x] Amostras Airton/Amanda/Kayhan documentadas
- [x] Extrato XLSX com colunas canônicas (já em produção)
- [ ] Ajustes de dados Kayhan/Airton (negócio)
