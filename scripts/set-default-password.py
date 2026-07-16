#!/usr/bin/env python3
"""Ajusta política de senha e aplica CB26 para todos os colaboradores."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

import importlib.util

_spec = importlib.util.spec_from_file_location(
    "provision_colaboradores",
    Path(__file__).resolve().parent / "provision-colaboradores.py",
)
_provision = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_provision)

COLABORADORES = _provision.COLABORADORES
admin_headers = _provision.admin_headers
find_user = _provision.find_user
req = _provision.req

PROJECT = "grlkbtnwvxorlfglyzid"
DEFAULT_INITIAL_PASSWORD = os.environ.get("DEFAULT_INITIAL_PASSWORD", "CB2026")


def patch_auth_config() -> None:
    token = os.environ["SUPABASE_ACCESS_TOKEN"]
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth"
    body = json.dumps({
        "password_min_length": len(DEFAULT_INITIAL_PASSWORD),
        "password_required_characters": "",
    }).encode()
    req_obj = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req_obj, timeout=60) as res:
            print("auth config:", res.read().decode()[:500])
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"auth config: {e.code} {e.read().decode()}") from e


def set_password(base: str, user_id: str, email: str) -> None:
    code, data = req(
        "PUT",
        f"{base}/auth/v1/admin/users/{user_id}",
        admin_headers(),
        {"password": DEFAULT_INITIAL_PASSWORD},
    )
    if code >= 400:
        raise RuntimeError(f"{email}: {code} {data}")


def main() -> int:
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")

    ok = 0
    errors = []
    for colab in COLABORADORES:
        email = colab["email"].lower()
        try:
            user = find_user(base, email)
            if not user:
                errors.append({"email": email, "erro": "usuário não encontrado"})
                continue
            set_password(base, user["id"], email)
            print(f"ok {email}")
            ok += 1
        except Exception as err:  # noqa: BLE001
            print(f"erro {email}: {err}", file=sys.stderr)
            errors.append({"email": email, "erro": str(err)})

    print(json.dumps({"senha": DEFAULT_INITIAL_PASSWORD, "ok": ok, "erros": errors}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
