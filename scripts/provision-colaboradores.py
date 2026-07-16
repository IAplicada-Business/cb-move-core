#!/usr/bin/env python3
"""Cadastra colaboradores no Supabase (sem enviar convites)."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

DEFAULT_INITIAL_PASSWORD = os.environ.get("DEFAULT_INITIAL_PASSWORD", "CB2026")

COLABORADORES = [
    {"nome": "Mariana", "email": "mariana@iaplicada.com", "role": "admin", "only_fix": True},
    {"nome": "Charlene Brito de Oliveira", "email": "cbmoveneuro@gmail.com", "role": "admin"},
    {"nome": "Diego Silveira de Paula Xavier", "email": "diegoxavier.fisio@gmail.com", "role": "admin"},
    {"nome": "Adriano de Lima Cezar", "email": "adrianolimacezar@gmail.com", "role": "membro"},
    {"nome": "Brenda Lacerda Farias", "email": "lacerdabrenda21@gmail.com", "role": "membro"},
    {"nome": "Camila Aguiar Pereira", "email": "fisiocamilap@gmail.com", "role": "membro"},
    {"nome": "Carlos Eduardo Moraes Oliveira", "email": "moraes.cadu98@gmail.com", "role": "membro"},
    {"nome": "Daniele Martins Moraes", "email": "danielemoraes2@gmail.com", "role": "membro"},
    {"nome": "Fernanda Eduarda Pereira Ferreira", "email": "fernandapereira.fisioterapia@gmail.com", "role": "membro"},
    {"nome": "Gabriel Arrosi Fracaso", "email": "gabrielarrosi@gmail.com", "role": "membro"},
    {"nome": "Gabriel Romagna da Costa", "email": "gabrielcoxta@gmail.com", "role": "membro"},
    {"nome": "Gelson Leonardo dos Santos Klagenberg", "email": "leoklagenberg@gmail.com", "role": "membro"},
    {"nome": "Henrique Mollmann Pedrotti", "email": "hiquepedrotti@gmail.com", "role": "membro"},
    {"nome": "Kelen Silveira da Rosa", "email": "kelensilveira4@gmail.com", "role": "membro"},
    {"nome": "Leonardo Pires Batista", "email": "leonardopb15@hotmail.com", "role": "membro"},
    {"nome": "Lorenzo Caon Da Silva", "email": "lorenzocaon@gmail.com", "role": "membro"},
    {"nome": "Lucas da Silva Santos", "email": "fisiolucas.dsantos@gmail.com", "role": "membro"},
    {"nome": "Mathias Mariani de Campos Velho Teixeira", "email": "mathiasteixeira5@gmail.com", "role": "membro"},
    {"nome": "Ohana Figueiredo Medeiros", "email": "fisioterapiaohana@gmail.com", "role": "membro"},
    {"nome": "Raisa Machado Alves", "email": "raisa04@hotmail.com", "role": "membro"},
    {"nome": "Rebeca Andrade de Mello", "email": "rebecamello.a@gmail.com", "role": "membro"},
    {"nome": "Rinaldo Pietrowski Pinto", "email": "rinaldopietrowski@gmail.com", "role": "membro"},
    {"nome": "Taiane dos Santos Soares", "email": "taiane.soaress@hotmail.com", "role": "membro"},
    {"nome": "Thales Escalante", "email": "thales.escalante@gmail.com", "role": "membro"},
    {"nome": "Vitória Vicenza Pedroso da Silva", "email": "vicenzavitoria@gmail.com", "role": "membro"},
    {"nome": "William Vinícius Monteiro Pacheco", "email": "williammonteiro1988@gmail.com", "role": "membro"},
]


def req(method: str, url: str, headers: dict, body: dict | None = None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def admin_headers() -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def load_fisios(base: str) -> dict[str, str]:
    code, data = req("GET", f"{base}/rest/v1/fisioterapeutas?select=id,email", admin_headers())
    if code >= 400:
        raise RuntimeError(f"fisios: {code} {data}")
    out: dict[str, str] = {}
    for row in data or []:
        email = (row.get("email") or "").lower().strip()
        if email:
            out[email] = row["id"]
    return out


def find_user(base: str, email: str) -> dict | None:
    target = email.lower().strip()
    page = 1
    while True:
        code, data = req(
            "GET",
            f"{base}/auth/v1/admin/users?page={page}&per_page=200",
            admin_headers(),
        )
        if code >= 400:
            raise RuntimeError(f"buscar usuários: {code} {data}")
        users = (data or {}).get("users") or []
        for user in users:
            if (user.get("email") or "").lower().strip() == target:
                return user
        if len(users) < 200:
            break
        page += 1
    return None


def create_user(base: str, email: str, nome: str, role: str) -> dict:
    body = {
        "email": email.lower(),
        "password": DEFAULT_INITIAL_PASSWORD,
        "email_confirm": True,
        "user_metadata": {"nome": nome, "role": role, "must_reset_password": True},
    }
    code, data = req("POST", f"{base}/auth/v1/admin/users", admin_headers(), body)
    if code >= 400:
        raise RuntimeError(f"criar usuário {email}: {code} {data}")
    return data if isinstance(data, dict) else {}


def set_password(base: str, user_id: str, email: str) -> None:
    code, data = req(
        "PUT",
        f"{base}/auth/v1/admin/users/{user_id}",
        admin_headers(),
        {
            "password": DEFAULT_INITIAL_PASSWORD,
            "user_metadata": {"must_reset_password": True},
        },
    )
    if code >= 400:
        raise RuntimeError(f"definir senha {email}: {code} {data}")


def set_role(base: str, user_id: str, role: str) -> None:
    h = {**admin_headers(), "Prefer": "return=minimal"}
    code, data = req("DELETE", f"{base}/rest/v1/user_roles?user_id=eq.{user_id}", h)
    if code >= 400:
        raise RuntimeError(f"limpar roles {user_id}: {code} {data}")
    code, data = req("POST", f"{base}/rest/v1/user_roles", h, {"user_id": user_id, "role": role})
    if code >= 400:
        raise RuntimeError(f"inserir role {user_id}: {code} {data}")


def upsert_profile(base: str, user_id: str, nome: str, email: str, fisio_id: str | None) -> None:
    h = {**admin_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"}
    payload = {"id": user_id, "nome": nome, "email": email.lower()}
    if fisio_id:
        payload["fisioterapeuta_id"] = fisio_id
    code, data = req("POST", f"{base}/rest/v1/profiles", h, payload)
    if code >= 400:
        patch_payload = {"nome": nome, "email": email.lower()}
        if fisio_id:
            patch_payload["fisioterapeuta_id"] = fisio_id
        code2, data2 = req(
            "PATCH",
            f"{base}/rest/v1/profiles?id=eq.{user_id}",
            {**admin_headers(), "Prefer": "return=minimal"},
            patch_payload,
        )
        if code2 >= 400:
            raise RuntimeError(f"profile {email}: {code} {data} / {code2} {data2}")


def provision_one(
    base: str,
    colab: dict,
    fisios: dict[str, str],
    *,
    dry_run: bool,
) -> str:
    email = colab["email"].lower()
    nome = colab["nome"]
    role = colab["role"]
    fisio_id = fisios.get(email)

    user = find_user(base, email)
    if user:
        user_id = user["id"]
        if dry_run:
            return f"[dry-run] atualizar {email} -> {role}"
        set_role(base, user_id, role)
        upsert_profile(base, user_id, nome, email, fisio_id)
        set_password(base, user_id, email)
        return f"ok atualizado {email} ({role})"

    if colab.get("only_fix"):
        return f"skip {email} (não encontrado, only_fix)"

    if dry_run:
        return f"[dry-run] cadastrar {email} -> {role}"

    created = create_user(base, email, nome, role)
    user_id = created.get("id") or created.get("user", {}).get("id")
    if not user_id:
        user = find_user(base, email)
        user_id = user["id"] if user else None
    if not user_id:
        raise RuntimeError(f"sem user_id após cadastro: {created}")

    set_role(base, user_id, role)
    upsert_profile(base, user_id, nome, email, fisio_id)
    set_password(base, user_id, email)
    return f"ok cadastrado {email} ({role})"


def main() -> int:
    parser = argparse.ArgumentParser(description="Cadastra colaboradores no banco (sem enviar e-mail).")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    fisios = load_fisios(base)

    results = {
        "cadastrados": 0,
        "atualizados": 0,
        "ignorados": 0,
        "erros": [],
    }

    print(f"=== Cadastro no banco (senha inicial: {DEFAULT_INITIAL_PASSWORD}) ===")
    for colab in COLABORADORES:
        email = colab["email"].lower()
        try:
            msg = provision_one(base, colab, fisios, dry_run=args.dry_run)
            print(msg)
            if msg.startswith("ok cadastrado"):
                results["cadastrados"] += 1
            elif msg.startswith("ok atualizado"):
                results["atualizados"] += 1
            elif msg.startswith("skip"):
                results["ignorados"] += 1
        except Exception as err:  # noqa: BLE001
            print(f"erro {email}: {err}", file=sys.stderr)
            results["erros"].append({"email": email, "erro": str(err)})

    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 1 if results["erros"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
