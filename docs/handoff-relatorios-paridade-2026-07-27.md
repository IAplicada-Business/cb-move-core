# Paridade Relatórios CBmove × fluxo manual (Drive)

Auditoria inicial — **27/07/2026**  
Drive de referência: [6. CBmove](https://drive.google.com/drive/folders/1A6_5qq_GQuljJwEuO7lwAwzR0STRrZEV?usp=sharing)

## Estrutura do Drive (referência do cliente)

| Pasta                      | ID                                  | Conteúdo relevante                |
| -------------------------- | ----------------------------------- | --------------------------------- |
| **Relatórios Atendimento** | `1qO7RKTOhsnIV8cEr-g__87XgyswEvR3X` | Modelos + PDFs/XLSX de exemplo    |
| **Financeiro**             | `1z7mvfPb1bfQr-r4Ylwwt-nlBMDWSoJkh` | Planilha master 2026, LogJur, NFs |
| **Pacientes**              | `19oj2FWNbi7i1eB2v_t2WzhJ_PzRBCOYu` | Frequência 2026, lista e-mail     |
| **Templates**              | `15zzQY4lxAkSXMJJqLZ2IFc2ybNGaFWSi` | Agenda padrão, avaliação face     |

### Modelos manuais de atendimento (Drive)

| Arquivo manual                                   | Uso esperado                            |
| ------------------------------------------------ | --------------------------------------- |
| `RELATÓRIO DE ATENDIMENTO 2025.docx`             | Particular / convencional               |
| `Relatório Atendimento UNIMED.docx`              | Unimed                                  |
| `Relatório de atendimento Sharepoint Excel.xlsx` | Judicial / SharePoint                   |
| `RQ.GPS.09.106 … Terapias Complementares … xlsx` | Modelo institucional (PUC/complementar) |

### Amostras preenchidas (para diff visual)

- `AIRTON TONELO - Relatório … 032026-Assinatura.pdf`
- `AMANDA PAVAN - Relatório … UNIMED 042026.pdf`
- `KAYHAN BUSTAMANTE … 042026.pdf`

### Financeiro manual

- **`Relatório Financeiro 2026`** (Google Sheet → xlsx) — planilha master mensal
- **`Planilha Padrão LogJur.xlsm`** — faturamento convênios
- Colunas legadas documentadas em `docs/regras_fiscais.md` e `src/lib/domain/extrato-financeiro.ts`

---

## O que o sistema entrega hoje

### Relatórios de atendimento

| Aspecto          | Implementação                                                     |
| ---------------- | ----------------------------------------------------------------- |
| Geração          | Edge `gerar-relatorio-mensal` → PDF `grade_v2` (pdf-lib)          |
| Modelos DB       | `convencional`, `unimed`, `sharepoint`, `puc` (RQ.GPS.09.105–108) |
| Resolução modelo | `modelo_relatorio_preferido` > tipo paciente                      |
| Linhas           | Sessões P/RC, grid por data + fisio, footer valor                 |
| UI               | `/app/relatorios` (financeiro) + Prontuário > Documentos          |
| Lote             | Só **convênio**, sequencial no browser                            |
| Assinatura       | ClickSign (opcional) ou upload PDF físico                         |
| Import físico    | Scan → `documento_fisico`                                         |

### Relatórios financeiros

| Aspecto       | Implementação                                                                     |
| ------------- | --------------------------------------------------------------------------------- |
| Dashboard     | `/app/financeiro` — KPIs, receita convênio, extrato                               |
| RPCs          | `financeiro_kpis`, `relatorio_receita_convenio`, etc.                             |
| Extrato       | Colunas espelhando planilha (nome, freq, dias, sessões, plano, valores, situação) |
| Export        | CSV do extrato + impressão browser                                                |
| Import legado | `scripts/import-relatorio-financeiro.ts` (xlsx → cobranças)                       |

---

## Gap analysis — paridade com fluxo manual

Legenda: 🔴 crítico · 🟡 importante · 🟢 ok / parcial

### A. Relatórios de atendimento

| #   | Manual (Drive)                                                  | Sistema                                           | Gap                                                          |
| --- | --------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| A1  | **Layout diferente por modelo** (docx Unimed ≠ xlsx SharePoint) | **Um único PDF grade_v2** para todos              | 🔴 Layout não bate com modelos do Drive                      |
| A2  | Relatório UNIMED com campos específicos (CID, convênio, etc.)   | CID vazio; sem bloco Unimed                       | 🔴                                                           |
| A3  | SharePoint = **Excel** enviado ao convênio/judicial             | PDF genérico                                      | 🔴 Formato errado para judicial                              |
| A4  | Texto clínico / evolução no corpo                               | Só no modo `legado` (não exposto na UI)           | 🔴 Tutorial promete “IA redige”; PDF padrão não tem evolução |
| A5  | Assinatura em papel + scan                                      | Import físico existe                              | 🟢 Parcial — fluxo separado do digital                       |
| A6  | Um relatório oficial por mês                                    | Pode gerar duplicatas                             | 🟡 Sem unique (paciente, competência)                        |
| A7  | Lote fim de mês (todos convênios)                               | Lote convênio client-side                         | 🟡 Sem fila, zip, retry                                      |
| A8  | Templates RQ.GPS.* versionados                                  | Gravados em DB, **não aplicados** na geração      | 🔴 `substituirPlaceholders` não usado                        |
| A9  | Portal paciente vê laudo assinado                               | Filtro `status = assinado'`                       | 🟡 Import físico pode ficar fora do portal                   |
| A10 | Fisio gera no prontuário                                        | OK em Prontuário; `/app/relatorios` só financeiro | 🟡                                                           |

### B. Relatórios financeiros

| #   | Manual (Drive)                               | Sistema                              | Gap                                         |
| --- | -------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| B1  | **Planilha Excel master** editável mês a mês | Dashboard + extrato; sem export xlsx | 🔴 Cliente pode esperar mesma planilha      |
| B2  | Colunas SITUAÇÃO, freq, dias, retroativas    | Extrato mapeia observações + status  | 🟢 Parcial — conferir coluna a coluna       |
| B3  | LogJur .xlsm para convênios                  | Não exporta LogJur                   | 🔴                                          |
| B4  | Receita por convênio (visão mensal)          | RPC `relatorio_receita_convenio`     | 🟢 In-app only                              |
| B5  | Vínculo sessões relatório ↔ cobrança         | Tabelas independentes                | 🟡 `qtd_sessoes` pode divergir do relatório |
| B6  | Relatório IR anual                           | `gerar-relatorio-ir` stub JSON       | 🟡 PDF não implementado                     |

---

## Plano de trabalho sugerido (ordem)

### Fase 1 — Conferência objetiva (1–2 dias)

1. Baixar amostras do Drive (`scripts/download_drive_files.py` + IDs em `Relatórios Atendimento`).
2. Gerar PDFs de **Airton**, **Amanda Pavan**, **Kayhan** no sistema (mesma competência).
3. Diff visual campo a campo (layout, sessões, valores, assinaturas).
4. Exportar extrato Jul/2026 CSV e comparar com aba JULHO da planilha financeira.

### Fase 2 — Correções de paridade alta (dev)

1. **Layouts por modelo** — renderizadores distintos ou preenchimento dos templates Drive (docx/xlsx → PDF).
2. **SharePoint judicial** — export **xlsx** (não só PDF).
3. **Unimed** — CID + campos convênio no PDF.
4. **Export xlsx** do extrato financeiro (mesmas colunas da planilha master).

### Fase 3 — Operação

1. LogJur export / integração.
2. Lote server-side + zip.
3. Unique constraint relatório/competência.
4. Portal + status assinado unificado.

---

## Comandos úteis

```bash
# Mapear Drive (HTML em scripts/drive_import/)
python scripts/scrape_drive_folder.py

# Baixar planilha financeira + frequência + NFs
python scripts/download_drive_files.py

# Import financeiro (dry-run)
npx tsx scripts/import-relatorio-financeiro.ts

# Testes grade relatório
npm test -- relatorio-atendimento-linhas
```

## Arquivos-chave no código

- Atendimento: `supabase/functions/gerar-relatorio-mensal/`, `_shared/pdf-grade-v2.ts`, `_shared/relatorio-atendimento-linhas.ts`
- UI: `src/routes/app.relatorios.tsx`, `ProntuarioDocumentosTab.tsx`
- Financeiro: `src/components/domain/DashboardFinanceiro.tsx`, `src/lib/domain/extrato-financeiro.ts`
- Import: `scripts/import-relatorio-financeiro.ts`

---

## Próximo passo imediato

Rodar **Fase 1** para 3 pacientes amostra do Drive e produzir matriz de diferenças (OK / diverge / ausente). Isso vira backlog priorizado antes de codar layouts novos.
