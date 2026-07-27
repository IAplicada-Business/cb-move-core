#!/usr/bin/env python3
"""Aplica (ou reverte) migration de test mode: fisio vê todos os pacientes."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"
ROOT = Path(__file__).resolve().parent.parent
ENABLE = ROOT / "supabase/migrations/20260727150000_fisio_full_access_test_mode.sql"
REVERT = ROOT / "supabase/migrations/20260727150100_revert_fisio_full_access_test_mode.sql"


def mgmt_query(sql: str) -> object:
    token = os.environ["SUPABASE_ACCESS_TOKEN"]
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.loads(res.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()}") from e


def main() -> None:
    load_app_env()
    revert = "--revert" in sys.argv
    path = REVERT if revert else ENABLE
    label = "revert" if revert else "enable"
    print(f"Aplicando {label}: {path.name}")
    result = mgmt_query(path.read_text(encoding="utf-8"))
    print(json.dumps(result, indent=2, ensure_ascii=False) if result else "OK")
    if revert:
        print("\nLembre também: FISIO_FULL_ACCESS_TEST_MODE = false em src/lib/permissions.ts")
        print("e em supabase/functions/_shared/auth.ts")
    else:
        print("\nTest mode ativo no banco. Confirme FISIO_FULL_ACCESS_TEST_MODE = true no frontend.")


if __name__ == "__main__":
    main()
