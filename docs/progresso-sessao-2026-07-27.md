# Progresso CBmove — sessão 27/07/2026

Checkpoint para retomada. Branch **`main`**, remoto sincronizado até **`6ff6d1f`**.

App: https://cb-move-core.lovable.app  
Supabase: `grlkbtnwvxorlfglyzid`

---

## O que foi feito hoje

### Relatórios — backend e paridade (P0–P2)

| Item                                                                  | Status | Commit    |
| --------------------------------------------------------------------- | ------ | --------- |
| Judicial dual (PDF + XLSX SharePoint) + router de renderizadores      | ✅     | `50a9ea6` |
| Fix deploy EF (`pdf-brand` import legado)                             | ✅     | `bb9764d` |
| Unimed DOCX, PUC XLSX, templates RQ.GPS, extrato XLSX, modo legado UI | ✅     | `733b10d` |
| UI: menu **Abrir ▼** (PDF ou XLSX) em vez de dois botões              | ✅     | `6ff6d1f` |

**Migrations aplicadas (DB):**

- `20260727200000_relatorio_formato_arquivo.sql`
- `20260727210000_relatorio_judicial_dual.sql`
- `20260727220000_templates_rqgps_renderer.sql`
- `20260727230000_relatorio_formato_docx.sql`
- `20260727240000_backfill_relatorio_rodape.sql`

**Edge function `gerar-relatorio-mensal`:** deploy v30 (pós `733b10d`).

**Testes:** 123 passando (`npm test`).

### UI — escolha de arquivo (último commit)

Componente `src/components/domain/RelatorioArquivoMenu.tsx`:

- Relatório **dual** → dropdown **Abrir ▼** (PDF | XLSX)
- Relatório **único** → botão direto
- Integrado em: histórico, prontuário documentos, geração individual e lote
- Badge: **"PDF ou XLSX"** (não "PDF + XLSX")

### Auditoria Fase 1 (paridade × Drive)

Documentado em:

- `docs/handoff-relatorios-paridade-2026-07-27.md`
- `docs/fase1-paridade-relatorios-2026-07-27.md`
- Artefatos: `scripts/out/fase1-paridade/`

---

## Pendente para amanhã (prioridade sugerida)

### 1. Validar na UI (smoke test)

- [ ] Gerar relatório **judicial** → menu Abrir com PDF e XLSX
- [ ] Gerar **Unimed** → DOCX abre corretamente
- [ ] Gerar **PUC** → XLSX abre corretamente
- [ ] Modo legado (checkbox) → PDF com evolução clínica
- [ ] Exportar extrato Jul/2026 em XLSX no financeiro

### 2. Amostras Fase 1 (mesma competência do Drive)

Gerar **na UI** (script local falha — EF exige JWT de usuário):

- Amanda Pavan — Abr/2026 (Unimed)
- Kayhan — Abr/2026 (Bradesco)

Diff visual vs PDFs em `scripts/out/fase1-paridade/`.

### 3. Backlog Fase 2 / operação (não iniciado)

- [ ] Download **ZIP** no lote de relatórios
- [ ] Fila **assíncrona + polling** (lote server-side)
- [x] **Fase 2b:** paridade visual célula a célula (template XLSX master) — `docs/fase2-paridade-relatorios-2026-08-18.md` (18/08/2026)
- [ ] Export **LogJur** (.xlsm)
- [x] **`FISIO_FULL_ACCESS_TEST_MODE`** revertido — fisio vê só pacientes vinculados (ago/2026)

### 4. Divergências de dados (investigar)

- Kayhan: valor planilha R$ 9.044 vs sistema R$ 4.522 (Jul/2026)
- Airton: retroativos abr/mai na planilha; sem cobrança Jul no sistema
- Zero sessões no DB para Airton/Amanda/Kayhan — relatórios existem sem base de sessões

---

## Arquivos-chave

```
supabase/functions/_shared/relatorio/
supabase/functions/_shared/gerar-relatorio-mensal-core.ts
src/components/domain/RelatorioArquivoMenu.tsx
src/components/domain/RelatoriosHistoricoTab.tsx
src/components/domain/prontuario/ProntuarioDocumentosTab.tsx
src/routes/app.relatorios.tsx
src/lib/domain/relatorio-renderers.ts
src/components/domain/DashboardFinanceiro.tsx
src/lib/domain/extrato-financeiro.ts
```

---

## Como retomar

```bash
git pull origin main   # já em 6ff6d1f
npm test
npm run dev
```

Próximo passo natural: **smoke test na UI** + gerar amostras Amanda/Kayhan Abr/2026 para fechar diff Fase 1.

---

## Commits da sessão (ordem cronológica)

```
50a9ea6 Add judicial dual report output (PDF + XLSX) with renderer router and UI links.
bb9764d Fix pdf-brand import path in legado report renderer for edge deploy.
733b10d Extend report renderers: Unimed DOCX, PUC XLSX, RQ.GPS templates, extrato XLSX export, and legado UI.
6ff6d1f Replace dual PDF/XLSX buttons with an open menu so users choose which judicial report file to view.
```
