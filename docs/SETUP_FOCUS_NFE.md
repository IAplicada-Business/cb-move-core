# Setup Focus NFe — NFS-e Nacional POA

Provedor fiscal alvo do CB MOVE (substitui Safe Notas / Nuvem Fiscal).

## 1. Conta e empresa emitente

1. Login: [app.focusnfe.com.br](https://app.focusnfe.com.br)
2. **Empresas** → cadastrar CB MOVE (CNPJ + certificado A1)
3. Habilitar **NFS-e Nacional**:
   - Homologação: `habilita_nfsen_homologacao`
   - Produção: `habilita_nfsen_producao`
4. Painel da empresa → Ambiente Nacional NFS-e

## 2. Token da API (não é email/senha)

| Onde | Valor |
|------|-------|
| Menu | **Painel API → Tokens** |
| Testes | **Token de Homologação** |
| Produção | **Token de Produção** |

Autenticação HTTP Basic: usuário = token, senha vazia.

```bash
curl -u 'SEU_TOKEN:' https://homologacao.focusnfe.com.br/v2/empresas
```

## 3. Configurar no Supabase

**Opção A — SQL Editor** (recomendado):

1. Rodar [`scripts/seed-integracao-focusnfe.sql`](../scripts/seed-integracao-focusnfe.sql)
2. Substituir `<TOKEN_…>` e `<CNPJ_CB_MOVE…>`

**Opção B — Edge Secrets** (se tiver permissão Owner):

```
FOCUSNFE_TOKEN=...
FOCUSNFE_AMBIENTE=homologacao
FOCUSNFE_CNPJ_PRESTADOR=...
```

## 4. Deploy da edge function

```bash
supabase functions deploy emit-nf --project-ref grlkbtnwvxorlfglyzid
```

## 5. Fluxo automático

```
UI (modo Automático) → emit-nf
  → POST Focus /v2/nfsen?ref=cbmove-{nf_id}
  → poll GET até autorizado
  → PDF → Storage notas-fiscais
  → status emitida + send-nf-email → n8n
```

## 6. Parâmetros fiscais (POA / fisioterapia)

| Chave | Default | Descrição |
|-------|---------|-----------|
| `FOCUSNFE_CODIGO_TRIBUTACAO` | `040802` | LC 116 — Fisioterapia |
| `FOCUSNFE_CODIGO_NBS` | `123019200` | NBS 1.2301.92.00 |
| Município | `4314902` | Porto Alegre (fixo no código) |

⚠️ Validar com Diego se POA exige `codigo_tributacao_municipal_iss` ou IM no ambiente nacional.

## 7. Homologação (spike)

1. Criar NF pendente na UI (particular com CPF)
2. Emitir em modo **Automático (Focus NFe)**
3. Conferir número + PDF no Storage
4. Repetir: convênio (CNPJ) e judicial (corpo no `descricao_servico`)

## 8. Produção

1. Trocar `FOCUSNFE_AMBIENTE` → `producao`
2. Usar **Token de Produção**
3. Certificado A1 válido da clínica

## Segurança

- Nunca commitar token ou senha do painel no Git
- Rotacionar token se exposto em chat/e-mail
- Conta `maria.tech@iaplicada.com` = painel; API usa token separado
