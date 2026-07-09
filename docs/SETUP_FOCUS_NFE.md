# Setup Focus NFe — NFS-e Nacional POA

Provedor fiscal alvo do CB MOVE (substitui Safe Notas / Nuvem Fiscal).

> **Escopo:** Focus NFe emite **documentos fiscais** (NFS-e Nacional, NFe, etc.). **Não** gera boletos bancários, PIX nem concilia extrato Bradesco. Boletos particulares → integração **Cora** (`emit-boleto-cora`); conciliação → upload CSV/OFX Bradesco no app.

## 1. Conta e empresa emitente

1. Login: [app.focusnfe.com.br](https://app.focusnfe.com.br)
2. **Empresas** → cadastrar CB MOVE (CNPJ + certificado A1)
3. Habilitar **NFS-e Nacional**:
   - Homologação: `habilita_nfsen_homologacao`
   - Produção: `habilita_nfsen_producao`
4. Painel da empresa → Ambiente Nacional NFS-e

## 2. Token da API (não é email/senha)

| Tipo | Uso |
|------|-----|
| **Token revenda** (conta) | Cadastrar empresas via `POST /v2/empresas` |
| **Token homologação** (por empresa) | Emitir NFS-e de teste em `homologacao.focusnfe.com.br` |
| **Token produção** (por empresa) | Emitir NFS-e válidas em `api.focusnfe.com.br` |

O `emit-nf` usa **token da empresa** (`FOCUSNFE_TOKEN`), não o token revenda.

Após criar a empresa no painel ou via API, copie em **Empresas → Tokens**:
- Homologação → `FOCUSNFE_AMBIENTE=homologacao`
- Produção → `FOCUSNFE_AMBIENTE=producao`

```bash
curl -u 'SEU_TOKEN:' https://homologacao.focusnfe.com.br/v2/nfsen/{ref}
```

### CB MOVE (cadastrada 08/07/2026)

| Campo | Valor |
|-------|-------|
| Empresa Focus ID | `230418` |
| CNPJ | `42.082.795/0001-74` |
| NFS-e Nacional | homologação + produção habilitadas |
| Certificado A1 | Configurado no painel Focus (válido até 10/06/2027) |

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

## 5. Fluxo automático (assíncrono + webhook)

```
UI (modo Automático) → emit-nf
  → POST Focus /v2/nfsen?ref=cbmove-{nf_id}
  → status processando (DPS na fila)
  → webhook nfsen → focus-nfe-webhook
  → NF emitida + PDF Storage + send-nf-email → n8n
```

### Registrar webhook

```bash
python scripts/apply-migration-sql.py supabase/migrations/20260709180000_nf_status_processando.sql
python scripts/deploy-focus-nf.py
python scripts/register-focus-webhook.py
```

O script grava `FOCUSNFE_WEBHOOK_SECRET` em `integracao_config` e cria o gatilho `nfsen` na Focus apontando para:

`https://grlkbtnwvxorlfglyzid.supabase.co/functions/v1/focus-nfe-webhook`

Consulta manual (opcional): `GET /v2/nfsen/{ref}` ou `POST /v2/nfsen/{ref}/hook` para reenviar notificação.

## 6. Parâmetros fiscais (POA / fisioterapia)

| Chave | Default | Descrição |
|-------|---------|-----------|
| `FOCUSNFE_CODIGO_TRIBUTACAO` | `040802` | LC 116 — Fisioterapia |
| `FOCUSNFE_CODIGO_NBS` | `123019200` | NBS 1.2301.92.00 |
| Município | `4314902` | Porto Alegre (fixo no código) |

⚠️ Validar com Diego se POA exige `codigo_tributacao_municipal_iss` ou IM no ambiente nacional.

## 7. Homologação (spike)

Pré-requisitos: certificado no painel Focus + token homologação no Supabase.

```bash
python scripts/apply-integracao-focusnfe.py
python scripts/verify-focus-nfe.py
supabase functions deploy emit-nf --project-ref grlkbtnwvxorlfglyzid
```

1. Criar NF pendente na UI (particular com CPF)
2. Emitir em modo **Automático (Focus NFe)** — agora é o padrão no modal
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
