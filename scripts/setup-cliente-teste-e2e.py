#!/usr/bin/env python3
"""Cria usuário cliente de teste vinculado a paciente dedicado (portal E2E)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from load_app_env import load_app_env

CLIENTE_EMAIL = "cliente.teste@iaplicada.com"
CLIENTE_NOME = "Cliente Teste Portal"
PACIENTE_NOME = "Paciente Cliente Teste Portal"
PASSWORD = os.environ.get("DEFAULT_INITIAL_PASSWORD", "CB2026")
ADMIN_EMAIL = "cbmoveneuro@gmail.com"


def anon_key() -> str:
    return (
        os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
        or ""
    )


def base_url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/")


def svc_headers() -> dict:
    k = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json", "Accept": "application/json"}


def req(method: str, url: str, headers: dict, body: dict | None = None, prefer: str | None = None) -> tuple[int, object]:
    h = dict(headers)
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
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


def sign_in(email: str, password: str) -> str:
    code, data = req(
        "POST",
        f"{base_url()}/auth/v1/token?grant_type=password",
        {"apikey": anon_key(), "Content-Type": "application/json"},
        {"email": email, "password": password},
    )
    if code != 200 or not isinstance(data, dict):
        raise RuntimeError(f"login {email}: {code} {data}")
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"sem token para {email}")
    return token


def ensure_paciente() -> str:
    b = base_url()
    code, rows = req(
        "GET",
        f"{b}/rest/v1/pacientes?select=id,nome,user_id&nome=eq.{urllib.parse.quote(PACIENTE_NOME)}",
        svc_headers(),
    )
    if code == 200 and rows:
        pac = rows[0]
        if pac.get("user_id"):
            req(
                "PATCH",
                f"{b}/rest/v1/pacientes?id=eq.{pac['id']}",
                svc_headers(),
                {"user_id": None},
                prefer="return=minimal",
            )
        return pac["id"]

    code2, created = req(
        "POST",
        f"{b}/rest/v1/pacientes",
        svc_headers(),
        {"nome": PACIENTE_NOME, "tipo": "particular", "ativo": True},
        prefer="return=representation",
    )
    if code2 >= 400:
        raise RuntimeError(f"criar paciente: {code2} {created}")
    return created[0]["id"]


def ensure_cliente_user(paciente_id: str) -> str:
    admin_token = sign_in(ADMIN_EMAIL, PASSWORD)
    code, data = req(
        "POST",
        f"{base_url()}/functions/v1/create-user",
        {
            "apikey": anon_key(),
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json",
        },
        {
            "email": CLIENTE_EMAIL,
            "nome": CLIENTE_NOME,
            "perfil": "cliente",
            "paciente_id": paciente_id,
        },
    )
    if code != 200 or not isinstance(data, dict) or not data.get("ok"):
        raise RuntimeError(f"create-user cliente: {code} {data}")
    user_id = data["user_id"]
    clear_must_reset(user_id)
    return user_id


def clear_must_reset(user_id: str) -> None:
    svc = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    code, _ = req(
        "PUT",
        f"{base_url()}/auth/v1/admin/users/{user_id}",
        {
            "apikey": svc,
            "Authorization": f"Bearer {svc}",
            "Content-Type": "application/json",
        },
        {
            "password": PASSWORD,
            "email_confirm": True,
            "user_metadata": {"must_reset_password": False, "role": "cliente", "nome": CLIENTE_NOME},
        },
    )
    if code >= 400:
        raise RuntimeError(f"limpar must_reset_password: {code}")


def verify_cliente(token: str, paciente_id: str) -> dict:
    code, pacientes = req(
        "GET",
        f"{base_url()}/rest/v1/pacientes?select=id,nome",
        {"apikey": anon_key(), "Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    code2, _ = req(
        "GET",
        f"{base_url()}/rest/v1/profiles?select=id",
        {"apikey": anon_key(), "Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    return {
        "login_ok": True,
        "pacientes_visiveis": len(pacientes) if isinstance(pacientes, list) else 0,
        "escopo_1_paciente": isinstance(pacientes, list) and len(pacientes) <= 1,
        "ve_paciente_vinculado": isinstance(pacientes, list) and any(p.get("id") == paciente_id for p in pacientes),
        "profiles_bloqueado": code2 == 403 or code2 == 401,
    }


def main() -> int:
    load_app_env()
    if not anon_key():
        print("Chave anon ausente", file=sys.stderr)
        return 1

    paciente_id = ensure_paciente()
    user_id = ensure_cliente_user(paciente_id)
    token = sign_in(CLIENTE_EMAIL, PASSWORD)
    checks = verify_cliente(token, paciente_id)

    out = {
        "user_id": user_id,
        "paciente_id": paciente_id,
        "email": CLIENTE_EMAIL,
        "password": PASSWORD,
        **checks,
        "ok": checks["escopo_1_paciente"] and checks["ve_paciente_vinculado"],
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))

    path = ROOT / "scripts" / "out" / "cliente-teste-e2e.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCredenciais salvas em {path}")
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
