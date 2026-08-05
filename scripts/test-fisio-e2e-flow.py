#!/usr/bin/env python3
"""Teste E2E fisio: escopo, cadastro bloqueado, agenda própria, vínculo por agendamento."""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from load_app_env import load_app_env

load_app_env()
spec = importlib.util.spec_from_file_location("setup", ROOT / "scripts/setup-fisio-teste-e2e.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

FISIO_ID = "7d320618-0bdd-47ee-97b9-2689b85d9b1a"
# paciente sem vínculo prévio com fisio teste
PACIENTE_LIVRE = "c947b61b-297c-4029-8fb2-72aef14ea2f4"


def svc_headers() -> dict:
    k = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json", "Accept": "application/json"}


def user_req(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, object]:
    anon = m.anon_key()
    h = {"apikey": anon, "Authorization": f"Bearer {token}", "Accept": "application/json", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{m.base_url()}/rest/v1/{path}", data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def main() -> int:
    print("=== Teste fisio clínico ===\n")
    token = m.sign_in(m.FISIO_EMAIL, m.PASSWORD)
    results: dict[str, object] = {}

    # 1) escopo pacientes
    code, rows = user_req("GET", "pacientes?select=id,nome", token)
    results["pacientes_visiveis"] = len(rows or [])
    results["escopo_pacientes_ok"] = code == 200 and len(rows or []) <= 2

    # 2) cadastro bloqueado
    code2, err = user_req(
        "POST",
        "pacientes",
        token,
        {"nome": "Teste Bloqueado Fisio", "tipo": "particular", "ativo": True},
    )
    results["cadastro_bloqueado"] = code2 == 403

    # 3) agenda própria vazia antes
    code3, ag0 = user_req("GET", "agendamentos?select=id,fisioterapeuta_id", token)
    results["agendamentos_antes"] = len(ag0 or [])

    # 4) recepção cria agendamento na coluna do fisio (service role)
    inicio = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=14, minute=0, second=0, microsecond=0)
    inicio_str = inicio.isoformat()
    svc = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    body = json.dumps({
        "paciente_id": PACIENTE_LIVRE,
        "fisioterapeuta_id": FISIO_ID,
        "inicio": inicio_str,
        "duracao_min": 50,
        "status": "agendado",
        "servico": "Primeira consulta experimental",
    }).encode()
    req = urllib.request.Request(
        f"{m.base_url()}/rest/v1/agendamentos?select=id,paciente_id,fisioterapeuta_id",
        data=body,
        method="POST",
        headers={**svc_headers(), "Prefer": "return=representation"},
    )
    agend_id = None
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            created = json.loads(res.read().decode())
            agend_id = created[0]["id"]
            results["agendamento_criado"] = True
    except urllib.error.HTTPError as e:
        results["agendamento_criado"] = False
        results["agendamento_erro"] = e.read().decode()[:200]

    # 5) trigger vinculou consulta experimental?
    req2 = urllib.request.Request(
        f"{m.base_url()}/rest/v1/pacientes?select=id,consulta_experimental_fisio_id,consulta_experimental_em&id=eq.{PACIENTE_LIVRE}",
        headers=svc_headers(),
    )
    with urllib.request.urlopen(req2, timeout=60) as res:
        pac = json.loads(res.read().decode())[0]
    results["consulta_experimental_fisio_id"] = pac.get("consulta_experimental_fisio_id")
    results["vinculo_por_agendamento_ok"] = pac.get("consulta_experimental_fisio_id") == FISIO_ID

    # 6) fisio vê o agendamento na coluna dele
    code4, ag1 = user_req("GET", f"agendamentos?select=id&fisioterapeuta_id=eq.{FISIO_ID}", token)
    results["agendamentos_visiveis"] = len(ag1 or [])
    results["agenda_coluna_ok"] = code4 == 200 and len(ag1 or []) >= 1

    # 7) fisio passa a ver paciente vinculado
    code5, pac_vis = user_req("GET", f"pacientes?select=id&id=eq.{PACIENTE_LIVRE}", token)
    results["ve_paciente_apos_agendamento"] = code5 == 200 and bool(pac_vis)

    results["tudo_ok"] = all(
        results.get(k)
        for k in (
            "escopo_pacientes_ok",
            "cadastro_bloqueado",
            "agendamento_criado",
            "vinculo_por_agendamento_ok",
            "agenda_coluna_ok",
            "ve_paciente_apos_agendamento",
        )
    )

    print(json.dumps(results, ensure_ascii=False, indent=2))

    # cleanup agendamento de teste + vínculo experimental deixado pelo trigger
    if agend_id:
        req_del = urllib.request.Request(
            f"{m.base_url()}/rest/v1/agendamentos?id=eq.{agend_id}",
            headers=svc_headers(),
            method="DELETE",
        )
        with urllib.request.urlopen(req_del, timeout=60):
            pass
        print(f"\nCleanup: agendamento {agend_id} removido")

    req_unlink = urllib.request.Request(
        f"{m.base_url()}/rest/v1/pacientes?id=eq.{PACIENTE_LIVRE}",
        data=json.dumps(
            {"consulta_experimental_fisio_id": None, "consulta_experimental_em": None},
        ).encode(),
        headers={**svc_headers(), "Prefer": "return=minimal"},
        method="PATCH",
    )
    with urllib.request.urlopen(req_unlink, timeout=60):
        pass
    print(f"Cleanup: vínculo experimental removido do paciente {PACIENTE_LIVRE}")

    return 0 if results["tudo_ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
