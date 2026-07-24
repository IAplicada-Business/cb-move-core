#!/usr/bin/env python3
"""Testa RPC cobrancas_sem_nf após fix v_conv."""
from __future__ import annotations

import os
import sys

import requests

from load_app_env import load_app_env


def main() -> int:
    load_app_env()
    base = (os.environ.get("SUPABASE_URL") or os.environ["VITE_SUPABASE_URL"]).rstrip("/")
    anon = (
        os.environ.get("VITE_SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )
    if not anon:
        print("FAIL: anon key ausente")
        return 1

    for mes, ano in [(7, 2026), (6, 2026)]:
        r = requests.post(
            f"{base}/rest/v1/rpc/cobrancas_sem_nf",
            headers={
                "apikey": anon,
                "Authorization": f"Bearer {anon}",
                "Content-Type": "application/json",
            },
            json={"p_mes": mes, "p_ano": ano},
            timeout=60,
        )
        if r.status_code >= 400:
            print(f"FAIL {mes:02d}/{ano}: HTTP {r.status_code} {r.text[:300]}")
            return 1
        rows = r.json()
        print(f"OK  {mes:02d}/{ano}: {len(rows)} cobrança(s) sem NF")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
