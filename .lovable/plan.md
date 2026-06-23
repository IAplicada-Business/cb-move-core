
# CB MOVE Neuroscience — Esqueleto do sistema

Confirmação antes de gerar código. Abaixo: passos, package.json proposto e pontos que precisam de decisão sua.

## Pontos que preciso confirmar antes de começar

1. **Supabase já conectado?** O projeto atual mostra que a integração Supabase do Lovable já está ativa (URL `grlkbtnwvxorlfglyzid`, anon key presente). Vou usar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` direto do `.env` gerenciado pela integração — **sem** Lovable Cloud, **sem** tocar em `client.server.ts` nem em server functions. ✔
2. **Schema do banco**: o blueprint cita tabelas (pacientes, prontuario, agenda, cobrancas, notas_fiscais, fisios, user_roles, convenios, instrumentos, templates, frequencia…). **Elas já existem no Supabase ou eu devo gerar a migration inicial junto?** Hoje o banco está vazio (sem tabelas/triggers). Sem schema, o dashboard fica permanentemente em EmptyState e queries quebram com "relation does not exist".
   - Opção A: você roda as migrations por fora e me passa o SQL depois — eu gero o esqueleto com queries apontando para nomes esperados (pode quebrar até o schema existir).
   - Opção B (recomendado): eu gero **migration inicial** com as tabelas mínimas + enum `app_role` + tabela `user_roles` + trigger `handle_new_user` que atribui `recepcao` por padrão + RLS básico.
3. **`types.ts` do Supabase**: como o banco está vazio, vou começar com um stub `Database = { public: { Tables: {} } }` e regenerar depois da migration. OK?
4. **Rotas com conteúdo vs placeholder**: você quer só o **esqueleto navegável** (cada rota com `EmptyState` + título) e implementação real só de Login + Dashboard nesta primeira leva, certo? As demais (pacientes/prontuário/agenda/etc) ficam stubs com layout pronto para iterar depois.
5. **Sem TanStack server functions / sem rotas server-only** — todo I/O passa pelo client Supabase no browser com RLS. Confirma?

## package.json proposto

```jsonc
{
  "dependencies": {
    // core do template (mantém)
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-start": "^1.x",
    "@tanstack/react-query": "^5.x",
    "react": "^19",
    "react-dom": "^19",

    // backend
    "@supabase/supabase-js": "^2",

    // forms + validação
    "react-hook-form": "^7",
    "@hookform/resolvers": "^3",
    "zod": "^3",

    // UI utilitários
    "sonner": "^1",
    "lucide-react": "^0.4xx",
    "clsx": "^2",
    "tailwind-merge": "^2",

    // charts
    "recharts": "^2",

    // shadcn primitives (instalados sob demanda conforme cada componente for adicionado)
    "@radix-ui/react-dialog": "*",
    "@radix-ui/react-dropdown-menu": "*",
    "@radix-ui/react-label": "*",
    "@radix-ui/react-select": "*",
    "@radix-ui/react-slot": "*",
    "class-variance-authority": "^0.7"
  }
}
```

**Removidos do template**: `cmdk`, `vaul`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `date-fns`, `@cloudflare/vite-plugin`, `wrangler`, `@lovable.dev/vite-tanstack-config` (se presentes). Vou checar `package.json` atual e remover só o que realmente estiver lá.

## Passos de execução (após você confirmar)

1. **Limpeza**: remover libs banidas, remover placeholder do `routes/index.tsx`.
2. **Design system**: reescrever `src/styles.css` com tokens CB MOVE (oklch + raw hex via `@theme`), Inter via `<link>` no `__root.tsx`, faixa arco-íris e halo do pin como utilities.
3. **(Opção B)** Migration inicial: enum `app_role` (admin/gestao/recepcao/fisio), `user_roles`, `has_role()`, trigger `handle_new_user`, tabelas mínimas (`pacientes`, `cobrancas`, `notas_fiscais`) com RLS + GRANTs.
4. **Supabase client**: `src/integrations/supabase/client.ts` + stub `types.ts`.
5. **Auth + RBAC**: `src/lib/auth.tsx` (provider + `useAuth`), `src/lib/permissions.ts`.
6. **Utils**: `format.ts` (BRL/data/CPF/telefone), `csv.ts`, `utils.ts`, `types.ts`, `queries/keys.ts`, `queries/index.ts` (`unwrap`).
7. **Layout**: `AppLayout`, `Sidebar` agrupada com pin ∞ + halo + faixa arco-íris + 4 grupos colapsáveis + toggle Admin/Paciente + footer com usuário real.
8. **shadcn sob demanda**: instalar `button`, `input`, `label`, `select`, `dialog`, `dropdown-menu`, `sonner`, `table` (um por vez conforme usados).
9. **Rotas**:
   - `/` redirect (sessão → `/app`, sem → `/login`)
   - `/login` com tabs Entrar/Criar conta
   - `/app/_layout` guard + AppLayout
   - `/app/` Dashboard real (4 KPIs, BarChart empilhado, tabela últimas 10 cobranças) — Recharts + Query
   - Demais rotas: stubs com título + `EmptyState`
10. **Domain components**: `StatusBadge`, `TipoBadge`, `KpiCard`, `EmptyState`, `LoadingState`, `AudioRecorder` (stub do MediaRecorder).

## Decisões pedidas

- **Migration inicial agora (Opção B) ou só o esqueleto frontend (Opção A)?**
- Confirma o package.json acima?
- Confirma que rotas além de Login/Dashboard ficam como stubs nesta primeira entrega?
