#!/usr/bin/env python3
"""Aplica um arquivo .sql de migration via Management API ou instrui SQL Editor."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"
QUERY_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: python scripts/apply-migration-sql.py <caminho.sql>", file=sys.stderr)
        return 1

    load_app_env()
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    sql_path = Path(sys.argv[1])
    if not sql_path.is_file():
        print(f"Arquivo não encontrado: {sql_path}", file=sys.stderr)
        return 1

    sql = sql_path.read_text(encoding="utf-8")
    if not token:
        print("SUPABASE_ACCESS_TOKEN ausente em .env.app", file=sys.stderr)
        print(f"Cole o SQL manualmente no editor: {sql_path}", file=sys.stderr)
        return 1

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
            print("OK", resp.status, resp.read().decode()[:500])
            return 0
    except urllib.error.HTTPError as e:
        print(f"Management API HTTP {e.code}", file=sys.stderr)
        print(e.read().decode(), file=sys.stderr)
        print(f"Alternativa: SQL Editor → {sql_path.name}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
