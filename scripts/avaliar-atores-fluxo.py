#!/usr/bin/env python3
"""Avalia fluxos por ator: login, rotas REST (RLS) e edge functions."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

PASSWORD = "CB2026"

ACTORS = [
    {
        "id": "admin_charlene",
        "label": "Administrador (Charlene)",
        "email": "cbmoveneuro@gmail.com",
        "expect_app": True,
        "expect_portal": False,
        "can_finance": True,
        "can_usuarios": True,
        "can_manage_pacientes": True,
    },
    {
        "id": "admin_mariana",
        "label": "Administrador (Mariana)",
        "email": "mariana@iaplicada.com",
        "expect_app": True,
        "expect_portal": False,
        "can_finance": True,
        "can_usuarios": True,
        "can_manage_pacientes": True,
    },
    {
        "id": "fisio_teste",
        "label": "Fisioterapeuta (teste E2E)",
        "email": "fisio.teste@iaplicada.com",
        "expect_app": True,
        "expect_portal": False,
        "can_finance": False,
        "can_usuarios": False,
        "can_manage_pacientes": False,
        "max_pacientes": 5,
    },
    {
        "id": "admin_vitoria",
        "label": "Administrador operacional (Vitória)",
        "email": "vicenzavitoria@gmail.com",
        "expect_app": True,
        "expect_portal": False,
        "can_finance": True,
        "can_usuarios": True,
        "can_manage_pacientes": True,
    },
]


def anon_key() -> str:
    return os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")


def base_url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/")


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


def sign_in(email: str, password: str) -> tuple[int, dict | None]:
    code, data = req(
        "POST",
        f"{base_url()}/auth/v1/token?grant_type=password",
        {"apikey": anon_key(), "Content-Type": "application/json"},
        {"email": email, "password": password},
    )
    if code != 200 or not isinstance(data, dict):
        return code, None
    return code, data


def rest_get(token: str, path: str) -> tuple[int, object]:
    return req(
        "GET",
        f"{base_url()}/rest/v1/{path}",
        {
            "apikey": anon_key(),
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )


def rest_post(token: str, path: str, body: dict) -> tuple[int, object]:
    return req(
        "POST",
        f"{base_url()}/rest/v1/{path}",
        {
            "apikey": anon_key(),
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=minimal",
        },
        body,
    )


def edge_list_users(token: str) -> tuple[int, object]:
    return req(
        "POST",
        f"{base_url()}/functions/v1/list-users",
        {
            "apikey": anon_key(),
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        {},
    )


def evaluate_actor(actor: dict) -> dict:
    result: dict[str, object] = {"id": actor["id"], "label": actor["label"], "email": actor["email"]}
    code, auth = sign_in(actor["email"], PASSWORD)
    result["login_ok"] = code == 200
    result["login_status"] = code
    if not auth:
        result["ok"] = False
        return result

    token = auth["access_token"]
    user_meta = auth.get("user", {})
    result["user_id"] = user_meta.get("id")
    result["last_sign_in_at"] = user_meta.get("last_sign_in_at")

    code_p, pacientes = rest_get(token, "pacientes?select=id")
    n_pac = len(pacientes) if isinstance(pacientes, list) else 0
    result["pacientes_count"] = n_pac
    result["pacientes_ok"] = code_p == 200

    code_post, _ = rest_post(
        token,
        "pacientes",
        {"nome": "Bloqueio Teste Ator", "tipo": "particular", "ativo": True},
    )
    result["cadastro_paciente_blocked"] = code_post == 403
    result["cadastro_paciente_status"] = code_post

    code_e, edge = edge_list_users(token)
    result["list_users_status"] = code_e
    if code_e == 200 and isinstance(edge, dict):
        users = edge.get("users", [])
        result["list_users_count"] = len(users)
        me = next((u for u in users if u.get("email", "").lower() == actor["email"].lower()), None)
        if me:
            result["auth_meta_loaded"] = me.get("auth_meta_loaded")
            result["last_sign_in_edge"] = me.get("last_sign_in_at")
    else:
        result["list_users_allowed"] = code_e != 403

    checks = []
    if actor.get("can_manage_pacientes"):
        checks.append(result.get("cadastro_paciente_blocked") is False)
    else:
        checks.append(result.get("cadastro_paciente_blocked") is True)

    if actor.get("can_usuarios"):
        checks.append(code_e == 200)
    else:
        checks.append(code_e in (401, 403))

    if actor.get("max_pacientes") is not None:
        checks.append(n_pac <= actor["max_pacientes"])

    result["ok"] = result["login_ok"] and all(checks)
    return result


def main() -> int:
    load_app_env()
    if not anon_key():
        print("SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY ausente", file=sys.stderr)
        return 1

    report = {"actors": [evaluate_actor(a) for a in ACTORS], "gaps": []}

    if not any(a["email"].endswith("@") for a in ACTORS):
        report["gaps"].append(
            "Nenhum usuário cliente cadastrado no banco — fluxo /portal não testável com login real."
        )

    print(json.dumps(report, ensure_ascii=False, indent=2))
    failed = [a for a in report["actors"] if not a.get("ok")]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
