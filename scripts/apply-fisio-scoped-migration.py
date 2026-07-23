#!/usr/bin/env python3
"""Aplica migrations de escopo fisio no Supabase remoto."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from load_app_env import load_app_env

PROJECT = "grlkbtnwvxorlfglyzid"
MIGRATIONS = [
    ROOT / "supabase/migrations/20260722235500_fix_pacientes_select_policy.sql",
    ROOT / "supabase/migrations/20260722240000_fisio_scoped_agenda.sql",
    ROOT / "supabase/migrations/20260722241000_fisio_no_cadastro_pacientes.sql",
    ROOT / "supabase/migrations/20260722242000_fisio_no_finance.sql",
    ROOT / "supabase/migrations/20260722242500_fix_finance_select_policies.sql",
]


def apply_sql(sql: str) -> None:
    token = os.environ["SUPABASE_ACCESS_TOKEN"]
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    req = urllib.request.Request(
        url,
        data=json.dumps({"query": sql}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        body = res.read().decode()
        if body.strip():
            print(body[:500])


def main() -> int:
    load_app_env()
    if not os.environ.get("SUPABASE_ACCESS_TOKEN"):
        print("SUPABASE_ACCESS_TOKEN ausente — aplique as migrations manualmente no Supabase.")
        return 1
    for path in MIGRATIONS:
        print(f"Aplicando {path.name}...")
        apply_sql(path.read_text(encoding="utf-8"))
        print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
