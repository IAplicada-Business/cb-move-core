# Validação — Fluxo de Frequência (Agenda)

Checklist executado em 14/07/2026 após correções na UI e na camada de dados.

## Checklist

| Item                               | Status | Observação                                                                           |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Verificar fluxo de frequência      | ✅     | Registro na aba Semana → sheet do agendamento → `sessoes` + sync de status           |
| Testar reagendamento entre semanas | ✅     | Preview avisa cruzamento de semana; após confirmar, agenda navega para a nova semana |
| Validar atualização da frequência  | ✅     | Sigla fina (FJ, RC, etc.) preservada; UI mostra marcação atual no sheet              |
| Confirmar contabilização correta   | ✅     | P + RC contam como realizadas; métricas em `frequencia.ts` cobertas por testes       |
| Registrar possíveis bugs           | ✅     | Ver seção abaixo                                                                     |

## Correções aplicadas (atualização pós code-review)

1. **Sigla sobrescrita** — `mirrorSessoes: false` em `registrarSiglaFrequencia`; espelho legado preserva siglas finas via `deveEspelharSiglaStatus`.
2. **Remarcação e planilha** — movimentos de sigla em fase separada após todos os agendamentos; deduplicação por dia origem/destino.
3. **Preview de remarcação** — consulta sigla do dia destino; mensagem distingue “será movida” vs “será removida”.
4. **Mesmo dia, nova hora** — `atualizarSessaoSiglaHora` atualiza `hora` na planilha.
5. **Auditoria** — troca de sigla sem mudança de status grava histórico (`frequencia:FJ` → `frequencia:F`).
6. **UI** — aviso quando há múltiplos agendamentos no mesmo dia; update otimista da sigla no sheet.
7. **Testes** — `resolveMoveSessaoSiglaDia`, `deveEspelharSiglaStatus`, `siglaEspelhoFromStatus`.
8. **Transação atômica** — RPC `remarcar_agendamentos_lote` (migration `20260714200000`) executa agendamentos + histórico + `sessoes` em uma única transação Postgres. Aplicada em 14/07/2026. Teste: `python scripts/test-remarcar-atomic.py`.

## Bugs conhecidos (pendentes)

| Prioridade | Bug                                                             | Impacto                                                                                                                 |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Alta       | `serie_id` raramente preenchido na criação                      | Escopos "semana" / "série do mês" podem afetar mais agendamentos do que o esperado                                      |
| Média      | Uma sessão por dia (`paciente_id` + `data`)                     | Dois agendamentos no mesmo dia compartilham uma célula na planilha                                                      |
| Média      | `clearSessaoSigla` ao reverter status apaga o dia inteiro       | Reverter um agendamento pode apagar frequência de outro slot no mesmo dia                                               |
| Baixa      | Tutorial `docs/tutoriais/02_marcar_frequencia.md` desatualizado | Documentação não reflete fluxo atual (sheet na Semana)                                                                  |
| Baixa      | Sem deep-link de semana/view na URL                             | Recarregar a página perde contexto de navegação                                                                         |
| Média      | `criado_por` não preenchido ao criar agendamento no modal       | Impossível auditar quem criou cada slot; implementar em `createAgendamento` / `createAgendamentosLote` com `auth.uid()` |

## Limpeza de dados de teste

Script: `python scripts/limpar-agendamentos-teste.py` (dry-run) / `--apply`.

Em 14/07/2026 removeu **37** agendamentos de jul/2026 (Airton Tonelo + paciente Teste + séries de lote de teste).

1. **Agenda → Semana** — abrir agendamento com paciente → marcar **FJ** → conferir toast e badge "Marcação atual: FJ".
2. **Aba Frequência** — célula do dia deve mostrar FJ (não F).
3. **Remarcar** para outra semana — preview laranja; após salvar, agenda abre na semana destino e célula migra na planilha.
4. **Prontuário / cobrança** — contagem de realizadas deve incluir RC e P apenas.
