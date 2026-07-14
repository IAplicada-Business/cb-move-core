#!/usr/bin/env python3
"""Grava N8N_WEBHOOK_BOLETO_DOCS em integracao_config (mantém demais chaves)."""
from __future__ import annotations

import json
import os
import sys
import urllib.request

from load_app_env import load_app_env

WEBHOOK_URL = "https://iaplicada.app.n8n.cloud/webhook/cbmove-boleto-docs"


def upsert(base: str, chave: str, valor: str) -> None:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = [{"chave": chave, "valor": valor}]
    req = urllib.request.Request(
        f"{base}/rest/v1/integracao_config?on_conflict=chave",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        res.read()


def main() -> None:
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    upsert(base, "N8N_WEBHOOK_BOLETO_DOCS", WEBHOOK_URL)
    print(f"OK: N8N_WEBHOOK_BOLETO_DOCS = {WEBHOOK_URL}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)
