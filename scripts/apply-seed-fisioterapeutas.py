#!/usr/bin/env python3
"""Aplica seed-fisioterapeutas-cbmove.sql no Supabase remoto."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from load_app_env import load_app_env

ROOT = Path(__file__).resolve().parent.parent
SQL_FILE = ROOT / "scripts" / "seed-fisioterapeutas-cbmove.sql"
PROJECT_REF = "grlkbtnwvxorlfglyzid"
QUERY_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"


def main() -> int:
    load_app_env()
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        print(
            "Defina SUPABASE_ACCESS_TOKEN em .env.app "
            "(copie .env.app.example → .env.app)",
            file=sys.stderr,
        )
        return 1

    sql = SQL_FILE.read_text(encoding="utf-8")
    req = urllib.request.Request(
        QUERY_URL,
        data=json.dumps({"query": sql}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode()
            print("OK", resp.status)
            if body.strip():
                print(body[:2000])
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}", file=sys.stderr)
        print(e.read().decode(), file=sys.stderr)
        return 1

    # Verificação
    check = """
    SELECT
      (SELECT count(*)::int FROM public.fisioterapeutas) AS fisios,
      (SELECT count(*)::int FROM public.agendamentos) AS agendamentos;
    """
    req2 = urllib.request.Request(
        QUERY_URL,
        data=json.dumps({"query": check}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req2, timeout=30) as resp:
        print(resp.read().decode())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
