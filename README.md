# CBmove — Neuroscience

Sistema de gestão clínica da **CB Move Neuroscience**: agenda, frequência, prontuário, financeiro, cobranças e portal do paciente.

## Início rápido

```bash
npm install
npm run dev
```

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run test` | Testes unitários (Vitest) |
| `npm run lint` | ESLint |

Variáveis de ambiente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ver [manual técnico](docs/manual_tecnico.md)).

## Documentação

| Documento | Público |
|-----------|---------|
| [Manual técnico](docs/manual_tecnico.md) | Desenvolvimento, deploy, migrations |
| [Validação agenda e frequência](docs/agenda-frequencia-validacao.md) | Regras de negócio da agenda |

## Tutoriais — Recepção e operação

Materiais de treinamento para a equipe da clínica:

| # | Tutorial | Tema |
|---|----------|------|
| 01 | [Login e cadastro de paciente](docs/tutoriais/01_login_cadastrar_paciente.md) | Primeiro acesso e cadastro |
| 02 | [Marcar frequência](docs/tutoriais/02_marcar_frequencia.md) | Presença, falta e reposição |
| 03 | [Emitir NF](docs/tutoriais/03_emitir_nf.md) | Nota fiscal de serviço |
| 04 | [Gerar relatório mensal](docs/tutoriais/04_gerar_relatorio_mensal.md) | Relatórios para convênios |
| 05 | [Transcrever evolução (áudio)](docs/tutoriais/05_transcrever_evolucao_audio.md) | Prontuário com IA |
| 06 | [Portal do paciente](docs/tutoriais/06_portal_paciente_visao_geral.md) | Visão geral do portal |
| 07 | [**Remarcar agendamento**](docs/tutoriais/07_remarcar_agendamento.md) | Remarcação na agenda, plano mensal e escopos |

O tutorial **07 — Remarcar agendamento** cobre o fluxo completo da recepção: escolha do novo horário na grade, avisos de impacto no plano mensal, escopo (pontual / semana / mês) e conferência após confirmar.

## Stack

TanStack Start · React 19 · Supabase · Tailwind CSS · shadcn/ui

Deploy via [Lovable](https://lovable.dev) (sync com `main` no GitHub).

## Suporte

**IAplicada Business** · mariana@iaplicada.com
