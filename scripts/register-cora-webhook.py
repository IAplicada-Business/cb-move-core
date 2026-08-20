#!/usr/bin/env python3
"""Registra o webhook invoice.paid na Cora (Integração Direta, mTLS) e grava
CORA_WEBHOOK_SHARED_SECRET + CORA_WEBHOOK_ENDPOINT_ID no Supabase.

python scripts/register-cora-webhook.py
"""
from __future__ import annotations

import os
import secrets
import sys
import tempfile
import uuid
from pathlib import Path

import requests

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"


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


def upsert_config(base: str, service_key: str, chave: str, valor: str) -> None:
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    res = requests.post(
        f"{base}/rest/v1/integracao_config?on_conflict=chave",
        json=[{"chave": chave, "valor": valor}],
        headers=headers,
        timeout=30,
    )
    res.raise_for_status()


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

    client_id = get_integracao_config(supabase_url, service_key, "CORA_CLIENT_ID")
    certificate = get_integracao_config(supabase_url, service_key, "CORA_CERTIFICATE")
    private_key = get_integracao_config(supabase_url, service_key, "CORA_PRIVATE_KEY")
    api_base = get_integracao_config(supabase_url, service_key, "CORA_API_BASE") or "https://matls-clients.api.stage.cora.com.br"
    if not client_id or not certificate or not private_key:
        print("CORA_CLIENT_ID / CORA_CERTIFICATE / CORA_PRIVATE_KEY não configurados.", file=sys.stderr)
        sys.exit(1)

    secret = os.environ.get("CORA_WEBHOOK_SHARED_SECRET") or get_integracao_config(
        supabase_url, service_key, "CORA_WEBHOOK_SHARED_SECRET"
    ) or secrets.token_urlsafe(32)

    webhook_url = f"https://{PROJECT_REF}.supabase.co/functions/v1/cora-webhook?secret={secret}"

    with tempfile.TemporaryDirectory() as tmpdir:
        cert_path = Path(tmpdir) / "cert.pem"
        key_path = Path(tmpdir) / "key.pem"
        cert_path.write_text(normalize_pem(certificate), encoding="utf-8")
        key_path.write_text(normalize_pem(private_key), encoding="utf-8")
        cert = (str(cert_path), str(key_path))

        token_res = requests.post(
            f"{api_base}/token",
            data={"grant_type": "client_credentials", "client_id": client_id},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            cert=cert,
            timeout=30,
        )
        token_res.raise_for_status()
        access_token = token_res.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

        list_res = requests.get(f"{api_base}/endpoints", headers=auth_headers, cert=cert, timeout=30)
        list_res.raise_for_status()
        endpoints = list_res.json()
        if not isinstance(endpoints, list):
            endpoints = []

        existing = next((ep for ep in endpoints if ep.get("url") == webhook_url), None)
        if existing:
            endpoint_id = existing["id"]
            print(f"OK endpoint já existia id={endpoint_id}")
        else:
            endpoint_res = requests.post(
                f"{api_base}/endpoints",
                json={"url": webhook_url, "resource": "invoice", "trigger": "paid"},
                headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
                cert=cert,
                timeout=30,
            )
            if not endpoint_res.ok:
                print(
                    f"Falha ao registrar endpoint ({endpoint_res.status_code}): {endpoint_res.text[:500]}",
                    file=sys.stderr,
                )
                sys.exit(1)
            endpoint_id = endpoint_res.json()["id"]

    upsert_config(supabase_url, service_key, "CORA_WEBHOOK_SHARED_SECRET", secret)
    upsert_config(supabase_url, service_key, "CORA_WEBHOOK_ENDPOINT_ID", endpoint_id)

    print(f"OK endpoint_id={endpoint_id}")
    print(f"OK CORA_WEBHOOK_SHARED_SECRET gravado ({secret[:6]}…)")
    print(f"URL registrada: https://{PROJECT_REF}.supabase.co/functions/v1/cora-webhook?secret=***")


if __name__ == "__main__":
    main()
