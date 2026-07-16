#!/usr/bin/env python3
"""Spike técnico Cora Stage — valida token mTLS, GET/POST /v2/invoices, /pay e criação de webhook.

Uso único (não faz parte do deploy): roda contra o Cora Stage já configurado em
`integracao_config` (mesmas credenciais usadas por `emit-boleto-cora`). Cria um boleto de
teste pequeno (R$ 5,00), consulta, paga via `/v2/invoices/pay` (endpoint exclusivo de Stage) e
tenta registrar + remover um endpoint de webhook. Não toca em nenhuma cobrança real do banco.

python scripts/spike_cora_stage.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import uuid
from datetime import date, timedelta
from pathlib import Path

import requests

from load_app_env import load_app_env

ROOT = Path(__file__).resolve().parent.parent


def get_integracao_config(base: str, service_key: str, chave: str) -> str | None:
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    res = requests.get(
        f"{base}/rest/v1/integracao_config",
        headers=headers,
        params={"select": "valor", "chave": f"eq.{chave}"},
        timeout=30,
    )
    res.raise_for_status()
    rows = res.json()
    return rows[0]["valor"] if rows else None


def normalize_pem(value: str) -> str:
    return value.replace("\\n", "\n").strip() + "\n"


def main() -> None:
    load_app_env()
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        print("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env/.env.app", file=sys.stderr)
        sys.exit(1)
    supabase_url = supabase_url.rstrip("/")

    print("== 1. Lendo credenciais Cora de integracao_config ==")
    client_id = get_integracao_config(supabase_url, service_key, "CORA_CLIENT_ID")
    certificate = get_integracao_config(supabase_url, service_key, "CORA_CERTIFICATE")
    private_key = get_integracao_config(supabase_url, service_key, "CORA_PRIVATE_KEY")
    api_base = get_integracao_config(supabase_url, service_key, "CORA_API_BASE") or "https://matls-clients.api.stage.cora.com.br"
    if not client_id or not certificate or not private_key:
        print("CORA_CLIENT_ID / CORA_CERTIFICATE / CORA_PRIVATE_KEY não configurados.", file=sys.stderr)
        sys.exit(1)
    print(f"OK client_id={client_id} api_base={api_base}")

    with tempfile.TemporaryDirectory() as tmpdir:
        cert_path = Path(tmpdir) / "cora_cert.pem"
        key_path = Path(tmpdir) / "cora_key.pem"
        cert_path.write_text(normalize_pem(certificate), encoding="utf-8")
        key_path.write_text(normalize_pem(private_key), encoding="utf-8")
        cert = (str(cert_path), str(key_path))

        print("\n== 2. POST /token (mTLS, client_credentials) ==")
        token_res = requests.post(
            f"{api_base}/token",
            data={"grant_type": "client_credentials", "client_id": client_id},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            cert=cert,
            timeout=30,
        )
        print(f"status={token_res.status_code}")
        if not token_res.ok:
            print(token_res.text[:1000], file=sys.stderr)
            sys.exit(1)
        access_token = token_res.json()["access_token"]
        print("OK token obtido")
        auth_headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

        print("\n== 3. POST /v2/invoices (boleto de teste R$ 5,00) ==")
        due_date = date.today().isoformat()
        code = f"spike-cora-{uuid.uuid4().hex[:12]}"
        payload = {
            "code": code,
            "customer": {
                "name": "Spike Teste CB MOVE",
                "email": "spike-cora-teste@cbmove.com.br",
                "document": {"identity": "11144477735", "type": "CPF"},
            },
            "services": [
                {"name": "Spike técnico Cora", "description": "Boleto de teste — automação NF", "amount": 500},
            ],
            "payment_terms": {"due_date": due_date},
        }
        idempotency_key = str(uuid.uuid4())
        create_res = requests.post(
            f"{api_base}/v2/invoices",
            json=payload,
            headers={**auth_headers, "Idempotency-Key": idempotency_key},
            cert=cert,
            timeout=30,
        )
        print(f"status={create_res.status_code}")
        if not create_res.ok:
            print(create_res.text[:2000], file=sys.stderr)
            sys.exit(1)
        invoice = create_res.json()
        invoice_id = invoice["id"]
        print(f"OK invoice_id={invoice_id} status={invoice.get('status')}")

        print("\n== 4. GET /v2/invoices/{id} ==")
        get_res = requests.get(f"{api_base}/v2/invoices/{invoice_id}", headers=auth_headers, cert=cert, timeout=30)
        print(f"status={get_res.status_code}")
        if get_res.ok:
            got = get_res.json()
            print(f"OK status={got.get('status')} amountTotal={got.get('amountTotal') or got.get('amount')}")
        else:
            print(get_res.text[:1000], file=sys.stderr)

        print("\n== 5. POST /v2/invoices/pay (endpoint exclusivo Stage) ==")
        pay_res = requests.post(
            f"{api_base}/v2/invoices/pay",
            json={"id": invoice_id},
            headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
            cert=cert,
            timeout=30,
        )
        print(f"status={pay_res.status_code}")
        pay_body = None
        if pay_res.ok:
            pay_body = pay_res.json()
            print(f"OK status={pay_body.get('status')}")
        else:
            print(pay_res.text[:2000], file=sys.stderr)

        print("\n== 6. GET /v2/invoices/{id} (pós-pagamento) ==")
        get_res2 = requests.get(f"{api_base}/v2/invoices/{invoice_id}", headers=auth_headers, cert=cert, timeout=30)
        print(f"status={get_res2.status_code}")
        if get_res2.ok:
            got2 = get_res2.json()
            print(f"OK status={got2.get('status')} payments={got2.get('payments')}")
        else:
            print(get_res2.text[:1000], file=sys.stderr)

        print("\n== 7. POST /endpoints (registro de webhook, placeholder) ==")
        endpoint_id = None
        endpoint_res = requests.post(
            f"{api_base}/endpoints",
            json={
                "url": "https://example.com/cbmove-cora-webhook-spike-placeholder",
                "resource": "invoice",
                "trigger": "paid",
            },
            headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
            cert=cert,
            timeout=30,
        )
        print(f"status={endpoint_res.status_code}")
        if endpoint_res.ok:
            endpoint = endpoint_res.json()
            endpoint_id = endpoint.get("id")
            print(f"OK endpoint_id={endpoint_id} {json.dumps(endpoint)}")
        else:
            print(endpoint_res.text[:2000], file=sys.stderr)

        if endpoint_id:
            print("\n== 8. DELETE /endpoints/{id} (limpeza do placeholder) ==")
            del_res = requests.delete(f"{api_base}/endpoints/{endpoint_id}", headers=auth_headers, cert=cert, timeout=30)
            print(f"status={del_res.status_code} {del_res.text[:500]}")

    print("\nSpike concluído.")


if __name__ == "__main__":
    main()
