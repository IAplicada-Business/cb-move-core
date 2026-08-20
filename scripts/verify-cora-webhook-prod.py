#!/usr/bin/env python3
"""Valida token mTLS produção + webhook invoice.paid registrado na Cora.

Lê credenciais de integracao_config (service role) e confere:
  1. Token contra CORA_API_BASE
  2. GET /endpoints — endpoint salvo existe, URL e trigger corretos

Uso:
  python scripts/verify-cora-webhook-prod.py
  python scripts/verify-cora-webhook-prod.py --fix   # re-registra se inválido

Requer SUPABASE_SERVICE_ROLE_KEY em .env.app
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
import uuid
from pathlib import Path

import requests

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"
PROD_BASE = "https://matls-clients.api.cora.com.br"
EXPECTED_PATH = f"/functions/v1/cora-webhook"


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


def cora_session(api_base: str, client_id: str, certificate: str, private_key: str):
    tmpdir = tempfile.TemporaryDirectory()
    cert_path = Path(tmpdir.name) / "cert.pem"
    key_path = Path(tmpdir.name) / "key.pem"
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
    return tmpdir, cert, auth_headers


def list_endpoints(api_base: str, cert, auth_headers) -> list[dict]:
    res = requests.get(f"{api_base}/endpoints", headers=auth_headers, cert=cert, timeout=30)
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else []


def register_endpoint(api_base: str, cert, auth_headers, webhook_url: str) -> str:
    res = requests.post(
        f"{api_base}/endpoints",
        json={"url": webhook_url, "resource": "invoice", "trigger": "paid"},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
        cert=cert,
        timeout=30,
    )
    if not res.ok:
        raise RuntimeError(f"Falha ao registrar endpoint ({res.status_code}): {res.text[:500]}")
    return res.json()["id"]


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


def endpoint_ok(endpoint: dict, expected_url: str) -> bool:
    return (
        endpoint.get("resource") == "invoice"
        and endpoint.get("trigger") == "paid"
        and endpoint.get("url") == expected_url
        and endpoint.get("active") is not False
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Verifica webhook Cora produção")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Re-registra webhook se o endpoint salvo não existir na Cora",
    )
    args = parser.parse_args()

    load_app_env()
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        print("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.app", file=sys.stderr)
        sys.exit(1)
    supabase_url = supabase_url.rstrip("/")

    client_id = get_integracao_config(supabase_url, service_key, "CORA_CLIENT_ID")
    certificate = get_integracao_config(supabase_url, service_key, "CORA_CERTIFICATE")
    private_key = get_integracao_config(supabase_url, service_key, "CORA_PRIVATE_KEY")
    api_base = (get_integracao_config(supabase_url, service_key, "CORA_API_BASE") or "").rstrip("/")
    endpoint_id = get_integracao_config(supabase_url, service_key, "CORA_WEBHOOK_ENDPOINT_ID")
    secret = get_integracao_config(supabase_url, service_key, "CORA_WEBHOOK_SHARED_SECRET")

    if not client_id or not certificate or not private_key:
        print("CORA_CLIENT_ID / CORA_CERTIFICATE / CORA_PRIVATE_KEY não configurados.", file=sys.stderr)
        sys.exit(1)

    if api_base != PROD_BASE:
        print(f"AVISO: CORA_API_BASE={api_base or '(vazio)'} — esperado produção {PROD_BASE}", file=sys.stderr)

    expected_url = f"https://{PROJECT_REF}.supabase.co{EXPECTED_PATH}?secret={secret}"
    if not secret:
        print("CORA_WEBHOOK_SHARED_SECRET vazio — rode register-cora-webhook.py primeiro.", file=sys.stderr)
        sys.exit(1)

    print("=== Verificação webhook Cora ===")
    print(f"CORA_API_BASE          : {api_base or PROD_BASE}")
    print(f"CORA_CLIENT_ID         : {client_id}")
    print(f"CORA_WEBHOOK_ENDPOINT  : {endpoint_id or '(vazio)'}")
    print(f"URL esperada (masked)  : https://{PROJECT_REF}.supabase.co{EXPECTED_PATH}?secret=***")

    tmpdir, cert, auth_headers = cora_session(
        api_base or PROD_BASE, client_id, certificate, private_key
    )
    try:
        print("\nOK token mTLS produção")
        endpoints = list_endpoints(api_base or PROD_BASE, cert, auth_headers)
        print(f"Endpoints na Cora ({len(endpoints)}):")
        for ep in endpoints:
            marker = ""
            if ep.get("id") == endpoint_id:
                marker = " ← salvo em integracao_config"
            print(
                f"  - {ep.get('id')} active={ep.get('active')} "
                f"resource={ep.get('resource')} trigger={ep.get('trigger')}{marker}"
            )
            print(f"    url={ep.get('url', '')[:80]}…" if len(ep.get("url", "")) > 80 else f"    url={ep.get('url')}")

        saved = next((ep for ep in endpoints if ep.get("id") == endpoint_id), None)
        matching = next((ep for ep in endpoints if endpoint_ok(ep, expected_url)), None)

        if saved and endpoint_ok(saved, expected_url):
            print("\n✓ Webhook produção OK — endpoint salvo existe e URL bate.")
            sys.exit(0)

        if matching and matching.get("id") != endpoint_id:
            print(f"\n⚠ Endpoint correto encontrado ({matching['id']}) mas integracao_config tem {endpoint_id}")
            print("  Atualizando CORA_WEBHOOK_ENDPOINT_ID…")
            upsert_config(supabase_url, service_key, "CORA_WEBHOOK_ENDPOINT_ID", matching["id"])
            print("✓ CORA_WEBHOOK_ENDPOINT_ID sincronizado.")
            sys.exit(0)

        stale = [ep for ep in endpoints if ep.get("resource") == "invoice" and ep.get("id") != endpoint_id]
        if stale:
            print("\n⚠ Endpoints invoice extras (possível lixo de stage):")
            for ep in stale:
                print(f"  - {ep.get('id')} url={ep.get('url')}")
            print("  Remova manualmente: DELETE /endpoints/{id} na API Cora correspondente.")

        if not args.fix:
            print("\n✗ Webhook inválido ou desatualizado. Rode:")
            print("  python scripts/register-cora-webhook.py")
            print("  ou: python scripts/verify-cora-webhook-prod.py --fix")
            sys.exit(1)

        print("\n--fix: registrando novo endpoint…")
        new_id = register_endpoint(api_base or PROD_BASE, cert, auth_headers, expected_url)
        upsert_config(supabase_url, service_key, "CORA_WEBHOOK_ENDPOINT_ID", new_id)
        print(f"✓ Novo endpoint_id={new_id}")
        sys.exit(0)
    finally:
        tmpdir.cleanup()


if __name__ == "__main__":
    main()
