#!/usr/bin/env python3
"""Mostra o ambiente Cora atual em integracao_config (sem expor PEMs)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from load_app_env import load_app_env

STAGE = "https://matls-clients.api.stage.cora.com.br"
PROD = "https://matls-clients.api.cora.com.br"

KEYS = (
    "CORA_API_BASE",
    "CORA_CLIENT_ID",
    "CORA_CERTIFICATE",
    "CORA_PRIVATE_KEY",
    "CORA_WEBHOOK_SHARED_SECRET",
    "CORA_WEBHOOK_ENDPOINT_ID",
    "CORA_AUTO_NF_ENABLED",
)


def get_rows(base: str, key: str) -> dict[str, str]:
    url = (
        f"{base}/rest/v1/integracao_config"
        f"?chave=in.({','.join(KEYS)})&select=chave,valor"
    )
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode())
    return {row["chave"]: row.get("valor") or "" for row in data}


def mask_secret(value: str, keep: int = 6) -> str:
    if not value:
        return "(vazio)"
    if len(value) <= keep * 2:
        return f"{value[:2]}…({len(value)} chars)"
    return f"{value[:keep]}…({len(value)} chars)"


def main() -> None:
    load_app_env()
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not os.environ.get(k)]
    if missing:
        print(f"Defina em .env.app: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    base = os.environ["SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    try:
        cfg = get_rows(base, service_key)
    except urllib.error.HTTPError as e:
        print(f"Erro Supabase ({e.code}): {e.read().decode()[:400]}", file=sys.stderr)
        sys.exit(1)

    api_base = (cfg.get("CORA_API_BASE") or "").strip()
    if api_base == PROD or api_base.rstrip("/") == PROD:
        ambiente = "PRODUCTION"
    elif api_base == STAGE or api_base.rstrip("/") == STAGE or not api_base:
        ambiente = "STAGE" if api_base else "STAGE (default — CORA_API_BASE vazio)"
    else:
        ambiente = f"CUSTOM ({api_base})"

    print("=== Cora — integracao_config ===")
    print(f"Ambiente inferido : {ambiente}")
    print(f"CORA_API_BASE     : {api_base or '(vazio → código usa stage)'}")
    print(f"CORA_CLIENT_ID    : {cfg.get('CORA_CLIENT_ID') or '(vazio)'}")
    print(f"CORA_CERTIFICATE  : {mask_secret(cfg.get('CORA_CERTIFICATE') or '')}")
    print(f"CORA_PRIVATE_KEY  : {mask_secret(cfg.get('CORA_PRIVATE_KEY') or '')}")
    print(f"WEBHOOK_SECRET    : {mask_secret(cfg.get('CORA_WEBHOOK_SHARED_SECRET') or '')}")
    print(f"WEBHOOK_ENDPOINT  : {cfg.get('CORA_WEBHOOK_ENDPOINT_ID') or '(vazio)'}")
    print(f"AUTO_NF_ENABLED   : {cfg.get('CORA_AUTO_NF_ENABLED') or '(vazio)'}")

    if "PRODUCTION" not in ambiente:
        print("\nCutover ainda não aplicado. Ver docs/CUTOVER_CORA_PRODUCAO.md")
        sys.exit(0)

    print("\nProdução ativa. Próximo: token + E2E boleto real pago.")
    sys.exit(0)


if __name__ == "__main__":
    main()
