# Aplicar migration `financeiro_mvp`

**Status:** aplicada em 07/07/2026 via `supabase db push` (migration `20260707120000`).

Arquivo: [`supabase/migrations/20260707120000_financeiro_mvp.sql`](../supabase/migrations/20260707120000_financeiro_mvp.sql)

## Opção A — Supabase CLI (recomendado)

No PowerShell, na pasta do projeto:

```powershell
cd D:\IAPLICADA\CBmove
supabase login
supabase link --project-ref grlkbtnwvxorlfglyzid
supabase db push
```

Se `supabase login` já foi feito em outra sessão, abra um terminal **interativo** novo e rode os comandos acima.

## Opção B — SQL Editor (Dashboard)

1. Abrir https://supabase.com/dashboard/project/grlkbtnwvxorlfglyzid/sql/new
2. Colar o conteúdo completo de `20260707120000_financeiro_mvp.sql`
3. Executar (Run)

## Validar após aplicar

No SQL Editor:

```sql
SELECT * FROM financeiro_kpis(6, 2026);
SELECT * FROM financeiro_kpis_por_tipo(6, 2026);
SELECT proname FROM pg_proc WHERE proname LIKE 'financeiro%' OR proname LIKE 'resolver%' OR proname LIKE 'cobrancas_sem%';
```

Resultado esperado Jun/2026: ~82 cobranças, total ~R$ 305.983,69.

## O que a migration cria

- Colunas: `convenios.cnpj`, `razao_social`, `email_nf`; `notas_fiscais.competencia_*`; `notas_fiscais_envios.event_id`
- RPCs: `financeiro_kpis`, `financeiro_kpis_por_tipo`, `relatorio_receita_convenio`, `resolver_destinatario_nf`, `criar_nf_de_cobranca`, `cobrancas_sem_nf`, `atualizar_cobrancas_vencidas`
