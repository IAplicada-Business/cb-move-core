#!/usr/bin/env python3
"""Smoke test: login CB2026, list_users RPC, edge functions."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

TEST_EMAIL = "cbmoveneuro@gmail.com"
PASSWORD = "CB2026"


def req(method: str, url: str, headers: dict, body: dict | None = None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def main() -> int:
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY", "")
    service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    print("=== 1. Login com senha padrão ===")
    code, data = req(
        "POST",
        f"{base}/auth/v1/token?grant_type=password",
        {"apikey": anon, "Content-Type": "application/json"},
        {"email": TEST_EMAIL, "password": PASSWORD},
    )
    print(f"login {TEST_EMAIL}: {code}", json.dumps(data, indent=2)[:600] if isinstance(data, dict) else data)
    token = (data or {}).get("access_token") if isinstance(data, dict) else None

    print("\n=== 2. RPC list_users (com token admin) ===")
    if token:
        code2, rpc = req(
            "POST",
            f"{base}/rest/v1/rpc/list_users",
            {"apikey": anon, "Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            {},
        )
        if code2 == 200 and isinstance(rpc, list):
            print(f"list_users OK: {len(rpc)} usuários")
        else:
            print(f"list_users: {code2}", str(rpc)[:400])

    print("\n=== 3. menu_permissions table ===")
    code3, menu = req(
        "GET",
        f"{base}/rest/v1/menu_permissions?select=role,menu_key&limit=3",
        {"apikey": service, "Authorization": f"Bearer {service}"},
    )
    print(f"menu_permissions: {code3}", menu)

    print("\n=== 4. Edge functions (invoke) ===")
    for fn in ["list-users", "create-user", "send-user-invite"]:
        code4, edge = req(
            "POST",
            f"{base}/functions/v1/{fn}",
            {"apikey": anon, "Authorization": f"Bearer {service}", "Content-Type": "application/json"},
            {"email": TEST_EMAIL} if fn != "list-users" else {},
        )
        print(f"{fn}: {code4}", str(edge)[:200])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
