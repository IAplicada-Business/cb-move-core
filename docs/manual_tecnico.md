# Manual Técnico — CB MOVE Neuroscience

## 1. Stack completo

| Camada | Tecnologia |
|--------|-----------|
| Framework | TanStack Start (SSR) |
| Roteamento | TanStack Router (file-based) |
| UI | React 19 |
| Build | Vite |
| CSS | Tailwind CSS 4 |
| Componentes | shadcn/ui |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Cliente | @supabase/supabase-js |
| Estado server | TanStack Query (React Query 5) |
| Formulários | react-hook-form + zod |
| Toasts | sonner |
| Ícones | lucide-react |

## 2. Deploy

- **Repositório:** github.com/IAplicada-Business/cb-move-core
- **Plataforma:** Lovable (auto-sync com o repositório — rebuild automático em ~60s após push)
- **Supabase project_id:** grlkbtnwvxorlfglyzid
- **URL Supabase:** configurada via variável de ambiente VITE_SUPABASE_URL

## 3. Variáveis de ambiente

### Client-side (prefixo VITE_)

```
VITE_SUPABASE_URL=https://grlkbtnwvxorlfglyzid.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...  (chave anon pública)
```

### Server-side (secrets no Supabase Dashboard → Settings → Edge Functions → Secrets)

```
ANTHROPIC_API_KEY=sk-ant-...        (transcrição de áudio e geração de relatórios IA)
CLICKSIGN_TOKEN=...                 (assinatura digital de documentos)
NFSE_API_KEY=...                    (emissão de notas fiscais, se integrado)
```

## 4. Como adicionar uma migration

1. Crie um arquivo em `supabase/migrations/` com o nome no formato:
   ```
   YYYYMMDDHHMMSS_descricao_curta.sql
   ```
2. Escreva o SQL de migration no arquivo.
3. Aplique via uma das opções:
   - **SQL Editor do Supabase Dashboard:** cole o conteúdo e execute
   - **MCP Supabase:** use `apply_migration` com `project_id: grlkbtnwvxorlfglyzid`
   - **Supabase CLI:** `supabase db push` (requer link do projeto)

**Convenções importantes:**
- Use `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`
- Para policies RLS: use o padrão `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Sempre habilite RLS: `ALTER TABLE public.TABELA ENABLE ROW LEVEL SECURITY;`

## 5. Como adicionar uma nova tela

1. Crie o arquivo de rota em `src/routes/`:
   - Para rotas internas (staff): `app.NOME.tsx`
   - Para rotas do portal (paciente): `portal.NOME.tsx`

2. Estrutura mínima do arquivo:
   ```tsx
   import { createFileRoute } from "@tanstack/react-router";
   
   export const Route = createFileRoute("/app/nome")({
     component: NomePage,
   });
   
   function NomePage() {
     return <div>Conteúdo</div>;
   }
   ```

3. Adicione o link no Sidebar em `src/components/layout/Sidebar.tsx`:
   ```tsx
   { to: "/app/nome", label: "Minha Tela", icon: IconeDoLucide }
   ```

4. Se a tabela ainda não estiver tipada nos types Supabase, use `(supabase as any).from("tabela")`.

## 6. Como adicionar um template de relatório

Execute no Supabase SQL Editor:

```sql
INSERT INTO public.templates_versionados (nome, modelo, versao, conteudo, ativo)
VALUES (
  'Nome do Template',
  'convencional',  -- ou 'unimed' ou 'sharepoint'
  1,
  '{ "secoes": [...] }'::jsonb,  -- estrutura do template
  true
);
```

Os campos disponíveis no JSON `conteudo` variam por modelo — consulte os templates existentes como referência.

## 7. Fluxo de PR / deploy

1. Crie uma branch a partir de `main`:
   ```bash
   git checkout -b feat/minha-feature
   ```
2. Faça commits seguindo o padrão `feat(escopo): descrição`.
3. Push para o GitHub:
   ```bash
   git push origin feat/minha-feature
   ```
4. Abra PR para `main`.
5. Após merge, o Lovable detecta o push em `main` e inicia rebuild automático em ~60 segundos.
6. Aplique a migration no Supabase se necessário (não é automático).
7. Edge Functions: `supabase functions deploy <nome> --project-ref grlkbtnwvxorlfglyzid`

**Check Supabase Preview no PR:** deve apontar para `grlkbtnwvxorlfglyzid`. Se falhar com outro `project_id` (ex. `zuxjjkewcckgzrjtcbcs`), corrija em [Supabase Dashboard → Integrations → GitHub](https://supabase.com/dashboard/project/grlkbtnwvxorlfglyzid/settings/integrations) e religue o repositório `cb-move-core`. O merge pode seguir mesmo com esse check falho se migrations já foram aplicadas manualmente.

**Branches especiais do Claude Code:**
- Branches `claude/NOME` são criadas automaticamente pelo Claude Code em worktrees isolados.
- Após revisão, faça push direto para `main`: `git push origin claude/NOME:main`

## 8. Suporte técnico

- **IAplicada Business**
- E-mail: mariana@iaplicada.com
- Responsável: Mariana Marques
- Para questões urgentes de produção: WhatsApp +55 51 992975877
