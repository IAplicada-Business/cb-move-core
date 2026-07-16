# Treinamento — Remarcar agendamento (Recepção)

**Público:** equipe de recepção e gestão  
**Módulo:** Agenda  
**Duração estimada do treinamento:** 15–20 min  
**Pré-requisito:** saber localizar pacientes e horários na agenda (Tutorial Agenda)

---

## 1. Objetivo

Ao final deste treinamento, a recepção deve conseguir:

- remarcar um horário com segurança;
- escolher o novo dia e horário sem confusão entre data, aba e grade;
- entender os avisos de impacto no plano mensal **antes** de confirmar;
- escolher o escopo correto (só este horário, semana ou mês);
- conferir o resultado após a confirmação.

---

## 2. Quando usar

Use **Remarcar** quando o paciente precisa mudar um horário já agendado, por exemplo:

- pedido do paciente ou responsável;
- indisponibilidade do fisioterapeuta;
- ajuste de rotina semanal;
- reorganização de sessões futuras do mesmo paciente.

**Não use** remarcar para:

- registrar falta ou presença → use **Frequência**;
- criar um horário novo sem vínculo com um agendamento anterior → use **Novo agendamento**;
- cancelar definitivamente sem novo horário → trate como cancelamento conforme procedimento da clínica.

---

## 3. Como abrir a remarcação

1. Acesse **Agenda** no menu lateral.
2. Localize o horário do paciente (visão semana ou dia).
3. Clique no agendamento para abrir os detalhes.
4. Selecione a opção **Remarcar**.

O sistema abre o assistente com:

- nome do paciente;
- horário atual;
- instrução para escolher o novo horário.

---

## 4. Passo a passo — escolher o novo horário

### 4.1 Fisioterapeuta

Selecione o fisioterapeuta que atenderá no novo horário.  
Por padrão, o sistema já traz o fisio do agendamento original.

### 4.2 Nova data e hora

Há **duas formas** de escolher — as duas ficam sempre sincronizadas:

| Forma | Como fazer |
|-------|------------|
| **Campos no topo** | Preencha **Nova data** (dd/mm/aa) e **Hora** (HH:mm) |
| **Grade da semana** | Clique em um horário **vago** na grade |

**Importante:** ao mudar a data no campo, a aba do dia (Seg, Ter, Qua…) muda junto. Ao clicar em uma aba, a data no campo também atualiza.

### 4.3 Grade da semana

A grade mostra:

- **Semana** visível (ex.: Semana 20 – 24 jul);
- abas dos dias úteis;
- horários vagos, ocupados e indisponíveis;
- destaque nos dias do **plano mensal** do paciente (quando aplicável).

**Regra prática:** prefira clicar em um horário **vago** na grade. Use os campos de data/hora manualmente só em casos especiais.

### 4.4 Novo horário selecionado

Antes de confirmar, confira o bloco **Novo horário selecionado**.  
Ele é o resumo final do que será gravado.

---

## 5. Avisos que podem aparecer

### 5.1 “A data cai em outra semana…”

Significa que o novo horário está em uma semana diferente da atual.

**O que acontece ao confirmar:** a agenda abre automaticamente na semana do novo horário.

### 5.2 “Impacto no plano mensal”

O sistema simula o efeito da remarcação no **plano contratual do mês** do paciente. Pode mostrar, por exemplo:

| Mensagem | Significado |
|----------|-------------|
| *1 slot ficará vazio no padrão contratual* | Um dia previsto no plano ficará sem sessão agendada |
| *1 horário ficará fora do padrão (extra)* | Um horário ficará fora dos dias previstos no contrato |
| *Plano após remarcação: X no padrão · Y faltante(s) · Z extra(s)* | Resumo previsto do mês após a mudança |

**Atenção:** esses avisos são uma **prévia**. Servem para a recepção decidir se a remarcação faz sentido antes de confirmar.

### 5.3 Conflito de horário (bloqueio)

Se o fisioterapeuta já tiver outro compromisso no mesmo horário, o sistema **não permite confirmar**.  
Nesse caso, escolha outro horário vago.

### 5.4 Frequência na planilha

Em alguns casos, o sistema avisa que a marcação de frequência (2ª, 3ª, 4ª…) será movida ou removida.  
Isso ocorre quando o novo dia já possui outra marcação na planilha do paciente.

---

## 6. Escopo do remanejamento

Antes de confirmar, escolha **o que mais será deslocado** junto com o horário selecionado:

| Opção | Use quando… | Efeito |
|-------|-------------|--------|
| **Só este horário** | Apenas uma sessão muda | Somente o horário aberto é remarcado |
| **Demais futuros na mesma semana** | O paciente troca a semana inteira | Todos os horários futuros do paciente **na mesma semana** são deslocados pelo mesmo intervalo |
| **Demais futuros até fim do mês** | Mudança estrutural no mês | Todos os horários futuros do paciente **até o fim do mês** são deslocados pelo mesmo intervalo |

O sistema mostra entre parênteses **quantos horários** serão afetados em cada opção.

**Dica:** na dúvida, comece com **Só este horário**. Só use semana ou mês quando a recepção tiver certeza de que o paciente quer mover todos os horários futuros.

---

## 7. Confirmar e conferir

### 7.1 Confirmar

1. Revise data, hora, fisio, avisos e escopo.
2. Clique em **Confirmar remarcação**.
3. Aguarde a mensagem de sucesso.

### 7.2 O que o sistema faz automaticamente

- o horário antigo fica registrado como **remarcado** (histórico preservado);
- um **novo agendamento** é criado no dia/hora escolhidos;
- a operação é registrada no **histórico**;
- a agenda é atualizada;
- se necessário, a tela navega para a **semana do novo horário**.

### 7.3 Conferência pós-remarcação (checklist)

- [ ] O paciente aparece no **novo** dia e horário
- [ ] O horário antigo não está mais ativo (consta como remarcado)
- [ ] A agenda está na semana correta
- [ ] O plano mensal do paciente reflete a mudança esperada

---

## 8. Exemplo prático

**Paciente:** Arthur Borba Tavares  
**Situação:** remarcar sessão de 15/07 às 08:00

| Etapa | Ação |
|-------|------|
| Abertura | Sistema mostra horário atual: 15/07/26 08:00 |
| Escolha | Novo horário: 20/07/26 12:40 (clicando em slot vago na grade) |
| Aviso de semana | “A data cai em outra semana…” → agenda irá para semana 20–24 jul |
| Impacto no plano | 11 no padrão · 1 faltante · 1 extra |
| Escopo | Só este horário |
| Resultado | Horário de 15/07 remarcado; novo agendamento em 20/07 12:40 |

---

## 9. Situações comuns

### Paciente quer só mudar o dia, mantendo a hora

1. Abra a remarcação.
2. Clique na aba do novo dia ou altere **Nova data**.
3. Mantenha a **Hora** igual.
4. Confirme.

### Paciente quer mudar hora no mesmo dia

1. Clique no novo slot vago na grade **do mesmo dia**, ou
2. Altere apenas o campo **Hora**.

### Paciente vai faltar na semana inteira e quer remarcar tudo

1. Escolha o primeiro horário da semana.
2. Defina o novo destino.
3. Selecione escopo **Demais futuros na mesma semana**.
4. Confira a quantidade de horários afetados antes de confirmar.

### Sistema não deixa confirmar

Verifique:

- horário escolhido está **vago** na grade?
- fisio correto?
- data e hora válidas (dd/mm/aa e HH:mm)?

---

## 10. Perguntas frequentes

**A prévia do plano mensal já altera o financeiro?**  
Não. É apenas uma simulação. Só após **Confirmar** os dados são gravados.

**O horário antigo some?**  
Não. Ele permanece no histórico como **remarcado**, vinculado ao novo horário.

**Posso remarcar para um dia fora do plano do paciente?**  
Sim, se houver horário vago. O sistema avisará que o horário ficará **fora do padrão contratual**.

**Preciso remarcar manualmente cada sessão do mês?**  
Não necessariamente. Use o escopo **até fim do mês** quando todos os horários futuros devem ser deslocados pelo mesmo intervalo.

**A aba do dia não batia com a data digitada. Isso foi corrigido?**  
Sim. Hoje a data do formulário e a aba ativa da grade usam a **mesma informação** — não devem mais divergir.

---

## 11. Erros a evitar

| Erro | Consequência | Como evitar |
|------|--------------|-------------|
| Confirmar sem ler o impacto no plano | Plano mensal com faltantes ou extras inesperados | Sempre expandir e ler **Impacto no plano mensal** |
| Usar escopo “mês” sem necessidade | Vários horários deslocados de uma vez | Confirmar com o paciente antes; preferir escopo pontual |
| Ignorar aviso de outra semana | Equipe procura o paciente na semana errada | Após confirmar, verificar se a agenda navegou para a semana correta |
| Tentar remarcar para horário ocupado | Sistema bloqueia a confirmação | Escolher slot **vago** (verde/disponível na grade) |

---

## 12. Roteiro para treinamento em equipe (15 min)

| Tempo | Atividade |
|-------|-----------|
| 3 min | Explicar quando usar remarcar vs. novo agendamento |
| 5 min | Demonstração ao vivo: remarcação pontual com grade |
| 3 min | Mostrar avisos de semana e impacto no plano |
| 3 min | Demonstrar escopos (pontual vs. semana) |
| 2 min | Checklist pós-confirmação e dúvidas |

---

## 13. Suporte

Em caso de comportamento inesperado após a remarcação, anote:

- nome do paciente;
- horário original;
- horário desejado;
- escopo escolhido;
- mensagem de erro (se houver);
- horário em que a operação foi feita.

Encaminhe ao suporte técnico ou gestão para verificação no histórico do agendamento.

---

*CBmove — Treinamento Recepção · Remarcar agendamento · Atualizado em jul/2026*
