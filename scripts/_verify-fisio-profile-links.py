#!/usr/bin/env python3
"""Auditoria completa: usuários, papéis e vínculo fisio."""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from load_app_env import load_app_env

load_app_env()
import os

base = (os.environ.get("SUPABASE_URL") or os.environ["VITE_SUPABASE_URL"]).rstrip("/")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}


def get(path: str) -> list:
    req = urllib.request.Request(f"{base}/rest/v1/{path}", headers=headers)
    with urllib.request.urlopen(req, timeout=60) as res:
        data = json.loads(res.read())
        return data if isinstance(data, list) else [data]


def main() -> None:
    roles = get("user_roles?select=user_id,role")
    by_user: dict[str, list[str]] = {}
    role_counts: dict[str, int] = {}
    for r in roles:
        by_user.setdefault(r["user_id"], []).append(r["role"])
        role_counts[r["role"]] = role_counts.get(r["role"], 0) + 1

    print("roles_no_sistema:", json.dumps(role_counts, ensure_ascii=False))

    profiles = get("profiles?select=id,nome,email,fisioterapeuta_id&order=nome")
    fisios = get("fisioterapeutas?select=id,nome,email,ativo&order=nome")
    fisio_by_id = {f["id"]: f for f in fisios}
    fisio_by_email = {
        (f.get("email") or "").strip().lower(): f
        for f in fisios
        if (f.get("email") or "").strip()
    }

    with_link = [p for p in profiles if p.get("fisioterapeuta_id")]
    print(f"profiles_com_fisioterapeuta_id: {len(with_link)}/{len(profiles)}")

    print("\n=== PROFILES COM fisioterapeuta_id ===")
    if not with_link:
        print("  (nenhum)")
    for p in with_link:
        f = fisio_by_id.get(p["fisioterapeuta_id"])
        user_roles = by_user.get(p["id"], [])
        print(
            json.dumps(
                {
                    "nome": p.get("nome"),
                    "email": p.get("email"),
                    "roles": user_roles,
                    "fisio_cadastro": f["nome"] if f else None,
                    "email_bate": (p.get("email") or "").strip().lower()
                    == (f.get("email") or "").strip().lower()
                    if f
                    else False,
                },
                ensure_ascii=False,
            )
        )

    print("\n=== USUARIOS STAFF (admin/membro/gestao/recepcao/fisio) ===")
    staff_roles = {"admin", "membro", "gestao", "recepcao", "fisio"}
    for p in profiles:
        user_roles = by_user.get(p["id"], [])
        if not set(user_roles) & staff_roles:
            continue
        email = (p.get("email") or "").strip().lower()
        fid = p.get("fisioterapeuta_id")
        match = fisio_by_email.get(email)
        print(
            json.dumps(
                {
                    "nome": p.get("nome"),
                    "email": p.get("email"),
                    "roles": user_roles,
                    "fisioterapeuta_id": fid,
                    "match_cadastro_por_email": match["nome"] if match else None,
                },
                ensure_ascii=False,
            )
        )

    pac = len(get("pacientes?select=id&ativo=eq.true&fisioterapeuta_id=not.is.null"))
    print(f"\npacientes_ativos_com_fisio_responsavel: {pac}")


if __name__ == "__main__":
    main()
