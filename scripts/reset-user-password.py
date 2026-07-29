#!/usr/bin/env python3
"""Redefine senha de um usuário via Supabase Admin API."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

_spec = importlib.util.spec_from_file_location(
    "provision_colaboradores",
    Path(__file__).resolve().parent / "provision-colaboradores.py",
)
_provision = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_provision)


def verify_login(base: str, email: str, password: str) -> None:
    key = (
        os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
    )
    url = f"{base.rstrip('/')}/auth/v1/token?grant_type=password"
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"apikey": key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        print(f"login OK ({res.status})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Redefine senha de um usuário")
    parser.add_argument("email")
    parser.add_argument("password")
    parser.add_argument("--no-verify", action="store_true")
    args = parser.parse_args()

    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    email = args.email.lower().strip()

    user = _provision.find_user(base, email)
    if not user:
        print(f"usuário não encontrado: {email}", file=sys.stderr)
        return 1

    metadata = dict(user.get("user_metadata") or {})
    metadata["must_reset_password"] = False

    code, data = _provision.req(
        "PUT",
        f"{base}/auth/v1/admin/users/{user['id']}",
        _provision.admin_headers(),
        {"password": args.password, "user_metadata": metadata},
    )
    if code >= 400:
        print(f"falha ao atualizar senha: {code} {data}", file=sys.stderr)
        return 1

    print(f"senha atualizada: {email}")
    if not args.no_verify:
        verify_login(base, email, args.password)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
