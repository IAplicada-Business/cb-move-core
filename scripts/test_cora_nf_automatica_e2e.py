#!/usr/bin/env python3
"""Teste E2E da automação NF pós-pagamento Cora, em Stage, com dados sintéticos descartáveis.

Cria 2 pacientes/cobrancas de teste ("TESTE AUTOMACAO CORA - APAGAR"):
  A) paga via API + aciona `cora-verificar-pagamentos` manualmente (fluxo polling).
  B) paga via API e aguarda o webhook real da Cora chegar em `cora-webhook` (fluxo webhook).

Confere: cobranca -> pago, notas_fiscais criada, emit-nf disparado, evento gravado em
cobrancas_pagamentos_eventos. Remove os dados de teste ao final (ou com --keep para inspecionar).

python scripts/test_cora_nf_automatica_e2e.py
"""
from __future__ import annotations

import os
import sys
import tempfile
import time
import uuid
from datetime import date
from pathlib import Path

import requests

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"
TEST_CPF = "11144477735"
TEST_LABEL = "TESTE AUTOMACAO CORA - APAGAR"


def rest(base, key, method, path, **kwargs):
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    headers.update(kwargs.pop("headers", {}))
    res = requests.request(method, f"{base}/rest/v1/{path}", headers=headers, timeout=30, **kwargs)
    res.raise_for_status()
    return res.json() if res.text else None


def get_config(base, key, chave):
    rows = rest(base, key, "GET", "integracao_config", params={"select": "valor", "chave": f"eq.{chave}"})
    return rows[0]["valor"] if rows else None


def create_test_cobranca(base, key, label_suffix, valor_reais):
    paciente = rest(
        base, key, "POST", "pacientes",
        headers={"Prefer": "return=representation"},
        json={"nome": f"{TEST_LABEL} {label_suffix}", "cpf": TEST_CPF, "email": "teste-automacao-cora@cbmove.com.br", "tipo": "particular"},
    )[0]
    hoje = date.today().isoformat()
    cobranca = rest(
        base, key, "POST", "cobrancas",
        headers={"Prefer": "return=representation"},
        json={
            "paciente_id": paciente["id"],
            "descricao": f"{TEST_LABEL} {label_suffix}",
            "valor": valor_reais,
            "tipo": "particular",
            "status": "pendente",
            "vencimento": hoje,
            "competencia_mes": date.today().month,
            "competencia_ano": date.today().year,
            "servico": "Teste automação Cora",
        },
    )[0]
    return paciente, cobranca


def create_and_pay_cora_invoice(api_base, cert, token, code, valor_centavos):
    payload = {
        "code": code,
        "customer": {
            "name": TEST_LABEL,
            "email": "teste-automacao-cora@cbmove.com.br",
            "document": {"identity": TEST_CPF, "type": "CPF"},
        },
        "services": [{"name": "Teste automação Cora", "description": "E2E automação NF", "amount": valor_centavos}],
        "payment_terms": {"due_date": date.today().isoformat()},
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    create_res = requests.post(
        f"{api_base}/v2/invoices", json=payload,
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())}, cert=cert, timeout=30,
    )
    create_res.raise_for_status()
    invoice = create_res.json()
    invoice_id = invoice["id"]

    pay_res = requests.post(
        f"{api_base}/v2/invoices/pay", json={"id": invoice_id},
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())}, cert=cert, timeout=30,
    )
    pay_res.raise_for_status()
    return invoice_id


def main() -> None:
    keep = "--keep" in sys.argv
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    client_id = get_config(base, key, "CORA_CLIENT_ID")
    certificate = get_config(base, key, "CORA_CERTIFICATE")
    private_key = get_config(base, key, "CORA_PRIVATE_KEY")
    api_base = get_config(base, key, "CORA_API_BASE") or "https://matls-clients.api.stage.cora.com.br"
    cron_secret = get_config(base, key, "CRON_SECRET")

    print("== Criando dados de teste (paciente + cobranca) ==")
    paciente_a, cobranca_a = create_test_cobranca(base, key, "(polling)", 5.00)
    paciente_b, cobranca_b = create_test_cobranca(base, key, "(webhook)", 5.00)
    print(f"cobranca_a={cobranca_a['id']} cobranca_b={cobranca_b['id']}")

    with tempfile.TemporaryDirectory() as tmpdir:
        cert_path = Path(tmpdir) / "cert.pem"
        key_path = Path(tmpdir) / "key.pem"
        cert_path.write_text(certificate.replace("\\n", "\n").strip() + "\n", encoding="utf-8")
        key_path.write_text(private_key.replace("\\n", "\n").strip() + "\n", encoding="utf-8")
        cert = (str(cert_path), str(key_path))

        token_res = requests.post(
            f"{api_base}/token", data={"grant_type": "client_credentials", "client_id": client_id},
            headers={"Content-Type": "application/x-www-form-urlencoded"}, cert=cert, timeout=30,
        )
        token_res.raise_for_status()
        token = token_res.json()["access_token"]

        print("\n== Criando e pagando boleto A (fluxo polling) ==")
        invoice_a = create_and_pay_cora_invoice(api_base, cert, token, cobranca_a["id"], 500)
        print(f"invoice_a={invoice_a}")

        print("\n== Criando e pagando boleto B (fluxo webhook) ==")
        invoice_b = create_and_pay_cora_invoice(api_base, cert, token, cobranca_b["id"], 500)
        print(f"invoice_b={invoice_b}")

    rest(base, key, "PATCH", f"cobrancas?id=eq.{cobranca_a['id']}", json={"cora_invoice_id": invoice_a, "boleto_modo": "automatico", "forma_pagamento": "boleto"})
    rest(base, key, "PATCH", f"cobrancas?id=eq.{cobranca_b['id']}", json={"cora_invoice_id": invoice_b, "boleto_modo": "automatico", "forma_pagamento": "boleto"})

    print("\n== Aguardando 15s (liquidação assíncrona em Stage) ==")
    time.sleep(15)

    print("\n== Disparando cora-verificar-pagamentos (fluxo A: polling manual) ==")
    poll_res = requests.post(
        f"{base}/functions/v1/cora-verificar-pagamentos",
        headers={"x-cron-secret": cron_secret} if cron_secret else {"Authorization": f"Bearer {key}"},
        timeout=60,
    )
    print(f"status={poll_res.status_code} body={poll_res.text[:1000]}")

    print("\n== Fluxo B: aguardando webhook real da Cora chegar em cora-webhook (até 60s) ==")
    cobranca_b_status = None
    for i in range(6):
        time.sleep(10)
        rows = rest(base, key, "GET", "cobrancas", params={"select": "status,pago_em", "id": f"eq.{cobranca_b['id']}"})
        cobranca_b_status = rows[0]["status"] if rows else None
        print(f"[{i+1}/6] cobranca_b.status={cobranca_b_status}")
        if cobranca_b_status == "pago":
            break

    print("\n== Resultado final ==")
    for label, cob_id in (("A (polling)", cobranca_a["id"]), ("B (webhook)", cobranca_b["id"])):
        cob = rest(base, key, "GET", "cobrancas", params={"select": "*", "id": f"eq.{cob_id}"})[0]
        nfs = rest(base, key, "GET", "notas_fiscais", params={"select": "*", "cobranca_id": f"eq.{cob_id}"})
        eventos = rest(base, key, "GET", "cobrancas_pagamentos_eventos", params={"select": "*", "cobranca_id": f"eq.{cob_id}", "order": "criado_em.asc"})
        print(f"\n--- {label} ---")
        print(f"cobranca.status={cob['status']} pago_em={cob.get('pago_em')} boleto_modo={cob.get('boleto_modo')}")
        print(f"notas_fiscais: {len(nfs)} -> {[{'id': n['id'], 'status': n['status'], 'fiscal_provider': n.get('fiscal_provider')} for n in nfs]}")
        print(f"eventos: {len(eventos)} -> {[{'origem': e['origem'], 'marcou_pago': e['marcou_pago'], 'nf_criada': e['nf_criada'], 'emit_nf_disparado': e['emit_nf_disparado'], 'erro': e.get('erro')} for e in eventos]}")

    if keep:
        print("\n--keep informado: dados de teste NÃO removidos.")
        print(f"cobranca_a={cobranca_a['id']} cobranca_b={cobranca_b['id']} paciente_a={paciente_a['id']} paciente_b={paciente_b['id']}")
        return

    print("\n== Limpando dados de teste ==")
    for cob_id in (cobranca_a["id"], cobranca_b["id"]):
        rest(base, key, "DELETE", f"cobrancas_pagamentos_eventos?cobranca_id=eq.{cob_id}")
        rest(base, key, "DELETE", f"notas_fiscais?cobranca_id=eq.{cob_id}")
    rest(base, key, "DELETE", f"cobrancas?id=eq.{cobranca_a['id']}")
    rest(base, key, "DELETE", f"cobrancas?id=eq.{cobranca_b['id']}")
    rest(base, key, "DELETE", f"pacientes?id=eq.{paciente_a['id']}")
    rest(base, key, "DELETE", f"pacientes?id=eq.{paciente_b['id']}")
    print("OK — dados de teste removidos.")


if __name__ == "__main__":
    main()
