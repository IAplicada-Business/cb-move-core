#!/usr/bin/env python3
"""Cria fisio/paciente de teste e valida escopo RLS + checklist E2E."""
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

FISIO_EMAIL = "fisio.teste@iaplicada.com"
FISIO_NOME = "Fisio Teste CBMove"
FISIO_REG = "CREFITO-TESTE-001"
PASSWORD = os.environ.get("DEFAULT_INITIAL_PASSWORD", "CB2026")
PACIENTE_TESTE_ID = "f4da1fb0-40f0-49e7-91d5-575ea865cbe0"
ADMIN_EMAIL = "mariana@iaplicada.com"


def anon_key() -> str:
    key = (
        os.environ.get("VITE_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    )
    if not key:
        raise RuntimeError("Defina VITE_SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY")
    return key


def headers(service: bool = True, user_token: str | None = None) -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"] if service else anon_key()
    token = user_token or key
    return {
        "apikey": key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def req(method: str, url: str, *, service: bool = True, user_token: str | None = None, body: dict | None = None, prefer: str | None = None) -> tuple[int, object]:
    h = headers(service, user_token)
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def base_url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/")


def find_user(email: str) -> dict | None:
    target = email.lower()
    page = 1
    while True:
        code, data = req("GET", f"{base_url()}/auth/v1/admin/users?page={page}&per_page=200")
        if code >= 400:
            raise RuntimeError(f"list users failed: {code} {data}")
        users = (data or {}).get("users") or []
        for user in users:
            if (user.get("email") or "").lower() == target:
                return user
        if len(users) < 200:
            break
        page += 1
    return None


def sign_in(email: str, password: str) -> str:
    code, data = req(
        "POST",
        f"{base_url()}/auth/v1/token?grant_type=password",
        service=False,
        body={"email": email, "password": password},
    )
    if code >= 400:
        raise RuntimeError(f"sign_in {email}: {code} {data}")
    token = (data or {}).get("access_token")
    if not token:
        raise RuntimeError(f"sem access_token para {email}")
    return token


def ensure_fisio_cadastro() -> str:
    b = base_url()
    code, rows = req(
        "GET",
        f"{b}/rest/v1/fisioterapeutas?select=id,email,nome&email=eq.{FISIO_EMAIL}",
    )
    if code >= 400:
        raise RuntimeError(f"buscar fisio: {code} {rows}")
    if rows:
        return rows[0]["id"]

    code, created = req(
        "POST",
        f"{b}/rest/v1/fisioterapeutas",
        body={"nome": FISIO_NOME, "email": FISIO_EMAIL, "registro_profissional": FISIO_REG, "ativo": True},
        prefer="return=representation",
    )
    if code >= 400:
        raise RuntimeError(f"criar fisio: {code} {created}")
    return created[0]["id"]


def ensure_user(fisio_id: str) -> str:
    b = base_url()
    user = find_user(FISIO_EMAIL)
    if not user:
        code, created = req(
            "POST",
            f"{b}/auth/v1/admin/users",
            body={
                "email": FISIO_EMAIL,
                "password": PASSWORD,
                "email_confirm": True,
                "user_metadata": {"nome": FISIO_NOME, "role": "membro", "must_reset_password": False},
            },
        )
        if code >= 400:
            raise RuntimeError(f"criar user: {code} {created}")
        user_id = created.get("id")
    else:
        user_id = user["id"]
        req(
            "PUT",
            f"{b}/auth/v1/admin/users/{user_id}",
            body={"password": PASSWORD, "email_confirm": True},
        )

    req("DELETE", f"{b}/rest/v1/user_roles?user_id=eq.{user_id}", prefer="return=minimal")
    code, data = req(
        "POST",
        f"{b}/rest/v1/user_roles",
        body={"user_id": user_id, "role": "membro"},
        prefer="return=minimal",
    )
    if code >= 400:
        raise RuntimeError(f"role membro: {code} {data}")

    code, _ = req(
        "POST",
        f"{b}/rest/v1/profiles",
        body={"id": user_id, "nome": FISIO_NOME, "email": FISIO_EMAIL, "fisioterapeuta_id": fisio_id},
        prefer="resolution=merge-duplicates,return=minimal",
    )
    if code >= 400:
        req(
            "PATCH",
            f"{b}/rest/v1/profiles?id=eq.{user_id}",
            body={"nome": FISIO_NOME, "email": FISIO_EMAIL, "fisioterapeuta_id": fisio_id},
            prefer="return=minimal",
        )
    return user_id


def link_paciente_teste(fisio_id: str) -> None:
    b = base_url()
    code, data = req(
        "PATCH",
        f"{b}/rest/v1/pacientes?id=eq.{PACIENTE_TESTE_ID}",
        body={"fisioterapeuta_id": fisio_id},
        prefer="return=representation",
    )
    if code >= 400:
        raise RuntimeError(f"link paciente teste: {code} {data}")


def count_visible(token: str, table: str, select: str = "id") -> int:
    code, rows = req("GET", f"{base_url()}/rest/v1/{table}?select={select}", user_token=token, service=False)
    if code >= 400:
        raise RuntimeError(f"count {table}: {code} {rows}")
    return len(rows or [])


def main() -> int:
    load_app_env()
    print("=== Setup fisio teste ===")
    fisio_id = ensure_fisio_cadastro()
    user_id = ensure_user(fisio_id)
    link_paciente_teste(fisio_id)
    print(json.dumps({
        "fisio_id": fisio_id,
        "user_id": user_id,
        "email": FISIO_EMAIL,
        "password": PASSWORD,
        "paciente_teste_id": PACIENTE_TESTE_ID,
    }, ensure_ascii=False, indent=2))

    print("\n=== Verificação RLS (JWT) ===")
    fisio_token = sign_in(FISIO_EMAIL, PASSWORD)
    admin_token: str | None = None
    try:
        admin_token = sign_in(ADMIN_EMAIL, PASSWORD)
    except RuntimeError as exc:
        print(f"admin login ignorado: {exc}")

    fisio_pacientes = count_visible(fisio_token, "pacientes")
    admin_pacientes = count_visible(admin_token, "pacientes") if admin_token else None
    fisio_sessoes = count_visible(fisio_token, "sessoes")
    fisio_rel = count_visible(fisio_token, "relatorios_atendimento")
    fisio_ag = count_visible(fisio_token, "agendamentos", "id,paciente_id")

    # paciente Teste visível?
    code, teste_rows = req(
        "GET",
        f"{base_url()}/rest/v1/pacientes?select=id,nome&id=eq.{PACIENTE_TESTE_ID}",
        user_token=fisio_token,
        service=False,
    )
    teste_ok = code == 200 and bool(teste_rows)

    # outro paciente (Camila) não visível?
    code2, camila_rows = req(
        "GET",
        f"{base_url()}/rest/v1/pacientes?select=id,nome&fisioterapeuta_id=eq.bc347ad9-12e7-41a1-a3fc-9de82373b054&limit=1",
        user_token=fisio_token,
        service=False,
    )
    camila_hidden = code2 == 200 and len(camila_rows or []) == 0

    results = {
        "fisio_pacientes_visiveis": fisio_pacientes,
        "admin_pacientes_visiveis": admin_pacientes,
        "fisio_sessoes_visiveis": fisio_sessoes,
        "fisio_relatorios_visiveis": fisio_rel,
        "fisio_agendamentos_visiveis": fisio_ag,
        "ve_paciente_teste": teste_ok,
        "nao_ve_paciente_camila": camila_hidden,
        "escopo_ok": fisio_pacientes <= 2 and teste_ok and camila_hidden,
    }
    print(json.dumps(results, ensure_ascii=False, indent=2))

    out = ROOT / "scripts" / "out" / "fisio-teste-e2e.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({**results, "credentials": {"email": FISIO_EMAIL, "password": PASSWORD}}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCredenciais salvas em {out}")
    return 0 if results["escopo_ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
