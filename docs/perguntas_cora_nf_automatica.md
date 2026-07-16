# Perguntas — Automação de NF pós-pagamento (Cora)

**Contexto:** vamos automatizar o disparo da nota fiscal assim que o boleto Cora for confirmado como pago (hoje isso é manual). A implementação já está em andamento no ambiente de teste (Stage) da Cora, sem risco para o sistema em produção. Antes de ligar isso de verdade, ficaram alguns pontos que só o cliente/fiscal pode confirmar — nada disso trava o desenvolvimento, é só para garantir que a regra final fique 100% alinhada com o negócio.

---

## Mensagem (copiar/enviar)

Oi! Estamos automatizando o seguinte: quando o boleto da Cora for pago, o sistema vai emitir a nota fiscal automaticamente (hoje isso é feito na mão). Para fechar a regra certinha, preciso confirmar alguns pontos:

**1. Essa regra vale para quem?**
"Só emitir NF depois do pagamento confirmado" vale só para os boletos particulares (via Cora), ou vocês querem esse mesmo princípio para convênio, judicial e PUC também? (Hoje esses outros tipos não têm um "boleto Cora" para se basear, então por padrão eles continuam como estão — emissão sem depender de pagamento.)

**2. E se o pagamento confirmar no fim do mês?**
A prefeitura exige emitir a NF até o último dia do mês de competência. Se o pagamento só for confirmado muito perto ou depois desse prazo, o que preferem: emitir mesmo assim com a competência original, ou tratar como pendência a regularizar depois?

**3. Segurança do aviso da Cora**
A Cora não garante uma forma de confirmar que o aviso de "pagamento recebido" realmente veio dela (não existe assinatura digital documentada). Nossa solução é nunca confiar só no aviso — sempre confirmar direto com a Cora antes de qualquer ação, usando um código secreto próprio nosso. Isso é suficiente para vocês, ou querem alguma camada extra de segurança?

**4. Quem pode desligar a automação em caso de problema?**
Vamos ter um "interruptor de emergência" para pausar a emissão automática se algo der errado. Ele precisa aparecer numa tela para a gestão/financeiro desligar sozinha, ou pode ficar só acessível pelo suporte técnico (nós)?

**5. Boletos com link colado manualmente**
Confirmar: ninguém hoje cola um código real da Cora num boleto cadastrado manualmente (fora do fluxo automático via API)? Se isso acontecer, a automação poderia disparar para um boleto que vocês estavam controlando à mão.

**6. Aviso de erro**
Se a emissão automática da NF falhar por algum motivo (dado faltando, etc.), isso deve só aparecer numa lista interna para checarmos depois, ou vocês querem ser avisados na hora (e-mail/WhatsApp)?

**7. Nova tentativa automática?**
Em caso de erro, preferem que o sistema tente de novo automaticamente, ou que continue como hoje — alguém clica em "Emitir NF" manualmente depois de corrigir o problema? (Recomendamos manter manual, para evitar uma ação fiscal disparando sem supervisão.)

**8. Escopo confirmado**
Confirma que essa automação deve valer só para boletos emitidos automaticamente pela Cora (via API) — e não para boletos com link colado manualmente, mesmo que marcados como pagos na tela?

Qualquer dúvida me chama. Obrigada!

---

## Referência interna (não enviar)

- Fonte: plano de arquitetura ["Automação NF pós-pagamento Cora"](../../.cursor/plans/) — pesquisa confirmou que a Cora tem webhook de pagamento (`invoice.paid`), mas o corpo vem vazio e sem assinatura documentada; por isso o desenho usa o webhook só como "campainha" e sempre revalida via `GET /v2/invoices/{id}` autenticado (mTLS) antes de qualquer ação.
- Pergunta 9 do arquiteto ("ambiente Stage ou Produção?") já foi respondida pelo usuário: **ainda é Stage/teste** — implementação segue com essa base, sem risco de produção.
- Enquanto as respostas não chegam, a implementação segue os defaults recomendados: automação escopada só a boletos `automatico` (Cora API), sem retry automático de NF, kill switch via `integracao_config` (sem UI dedicada por ora), erros só logados em `cobrancas_pagamentos_eventos`.
