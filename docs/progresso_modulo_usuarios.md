# Progresso — Módulo Administrativo / Usuários (CBmove)

> Registro de sessão para retomada. Atualizado em 16/07/2026.

## Contexto
Projeto **CBmove** — app em produção em `cb-move-core.lovable.app`, Supabase `grlkbtnwvxorlfglyzid`, branch `main` no GitHub `IAplicada-Business/cb-move-core`.

## Concluído nesta sessão

### 1. Bug de reload (loading infinito)
- Causa: deadlock do Supabase — queries chamadas dentro do callback `onAuthStateChange` enquanto `getSession()` rodava no bootstrap.
- Correção (`src/lib/auth.tsx`):
  - Bootstrap não espera mais `loadRoles` para liberar o loading.
  - Callbacks de auth adiados com `setTimeout(0)`.
  - Timeout de 8s + deduplicação nas queries de papéis.
- Commit: `055ccdd`

### 2. Logs de diagnóstico no console
- Novo módulo `src/lib/client-diagnostics.ts` — prefixo `[CBmove]`.
- Captura erros globais (`window.error`, `unhandledrejection`), falhas de React Query, e cada etapa do bootstrap de auth/guards de rota.
- Commit: `9d8faee`

### 3. Favicon
- Adicionado `public/favicon.svg` + link no `<head>` + redirect de `/favicon.ico` no servidor (elimina 404 no console).
- Commit: `9d8faee`

### 4. Lista de usuários unificada
- A aba **Usuários** agora mescla a equipe de referência (`COLABORADORES_REFERENCIA`, extraída do Drive) com usuários cadastrados diretamente no sistema que não estão nessa lista fixa (antes ficavam "invisíveis" na UI).
- Badge "Adicional" foi removida a pedido — todos aparecem sem distinção visual.
- Commits: `67c1b2f`, `0205282`

### 5. Exclusão de usuário
- Nova edge function **`delete-user`** (deployada no Supabase):
  - Remove do Auth, `profiles`, `user_roles`; desvincula `pacientes`.
  - Bloqueia auto-exclusão.
  - Bloqueia exclusão do último administrador.
- Botão de lixeira por linha na tabela + `AlertDialog` de confirmação.
- Commit: `f529545`

### 6. Busca de usuários
- Campo de busca por nome/e-mail acima da tabela, filtra equipe de referência + cadastros adicionais em tempo real.
- Commit: `f529545`

## Estado do repositório
Último commit em `main`: `f529545` (push confirmado).

```
f529545 feat(usuarios): adiciona exclusao de usuario e busca por nome/e-mail
0205282 fix(usuarios): remove badge Adicional dos novos cadastros
67c1b2f fix(usuarios): exibe usuarios cadastrados fora da equipe de referencia
055ccdd fix(auth): evita deadlock no reload ao restaurar sessão
9d8faee feat(debug): adiciona logs [CBmove] no reload e corrige favicon
```

## Arquivos principais tocados
- `src/lib/auth.tsx`, `src/lib/auth-routes.ts`, `src/lib/client-diagnostics.ts`
- `src/routes/__root.tsx`, `src/routes/app.tsx`, `src/routes/portal.tsx`, `src/routes/index.tsx`
- `src/router.tsx`, `src/server.ts`
- `src/routes/app.usuarios.tsx`, `src/lib/queries/usuarios.ts`
- `supabase/functions/delete-user/index.ts` (nova), `supabase/config.toml`
- `scripts/deploy-usuarios-functions.py`
- `public/favicon.svg` (novo)

## Pendências / próximos passos (etapa administrativa — retomar amanhã)
- [ ] Revisar com a equipe o que falta para considerar a etapa administrativa **finalizada** (ex.: edição inline de perfil, reenvio de senha padrão, auditoria de ações administrativas).
- [ ] Validar em produção o fluxo completo: cadastro → 1º login → redefinição de senha → aparecimento/exclusão na lista.
- [ ] Conferir se a Edge Function `create-user` está com a mesma versão em produção (deploy manual vs. sync automático do Lovable).
- [ ] Avaliar se vale mover o deploy de edge functions para o pipeline do Lovable (hoje é manual via `scripts/deploy-usuarios-functions.py` ou `supabase functions deploy`).
- [ ] `src/routeTree.gen.ts` continua fora dos commits (auto-gerado) — lembrar de regenerar localmente ao puxar `main`.

## Observações operacionais
- Deploy de edge function feito via CLI (`npx supabase functions deploy <nome> --project-ref grlkbtnwvxorlfglyzid`) usando `SUPABASE_ACCESS_TOKEN` de `.env.app` (não commitado).
- Script `scripts/deploy-usuarios-functions.py` está com a chamada à Management API desatualizada (token sem privilégio para `secrets`, e endpoint de deploy com erro de entrypoint) — usar CLI direto enquanto isso não for corrigido.
