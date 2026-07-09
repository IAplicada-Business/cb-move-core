#!/usr/bin/env python3
"""Aplica config Focus NFe em integracao_config via REST (não commitar tokens)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from load_app_env import load_app_env

REQUIRED = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FOCUSNFE_TOKEN", "FOCUSNFE_CNPJ_PRESTADOR")


def upsert_config(base: str, key: str, rows: list[tuple[str, str]]) -> None:
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = [{"chave": chave, "valor": valor} for chave, valor in rows]
    req = urllib.request.Request(
        f"{base}/rest/v1/integracao_config?on_conflict=chave",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        res.read()


def main() -> None:
    load_app_env()
    missing = [k for k in REQUIRED if not os.environ.get(k)]
    if missing:
        print(f"Defina em .env.app: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    base = os.environ["SUPABASE_URL"].rstrip("/")
    token = os.environ["FOCUSNFE_TOKEN"]
    cnpj = "".join(c for c in os.environ["FOCUSNFE_CNPJ_PRESTADOR"] if c.isdigit())
    ambiente = os.environ.get("FOCUSNFE_AMBIENTE", "homologacao")

    rows = [
        ("FOCUSNFE_TOKEN", token),
        ("FOCUSNFE_AMBIENTE", ambiente),
        ("FOCUSNFE_CNPJ_PRESTADOR", cnpj),
        ("FOCUSNFE_CODIGO_TRIBUTACAO", os.environ.get("FOCUSNFE_CODIGO_TRIBUTACAO", "040802")),
        ("FOCUSNFE_CODIGO_NBS", os.environ.get("FOCUSNFE_CODIGO_NBS", "123019200")),
        ("FOCUSNFE_SIMPLES_NACIONAL", os.environ.get("FOCUSNFE_SIMPLES_NACIONAL", "1")),
    ]
    im = os.environ.get("FOCUSNFE_INSCRICAO_MUNICIPAL")
    if im:
        rows.append(("FOCUSNFE_INSCRICAO_MUNICIPAL", "".join(c for c in im if c.isdigit())))

    try:
        upsert_config(base, "integracao_config", rows)
    except urllib.error.HTTPError as e:
        print(f"Erro Supabase ({e.code}): {e.read().decode()[:500]}", file=sys.stderr)
        sys.exit(1)

    for chave, valor in rows:
        mask = f"{valor[:8]}…" if "TOKEN" in chave else valor
        print(f"OK {chave} = {mask}")

    print("Config Focus NFe aplicada no Supabase.")


if __name__ == "__main__":
    main()
