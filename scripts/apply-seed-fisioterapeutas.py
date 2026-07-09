#!/usr/bin/env python3
"""Aplica seed de fisioterapeutas CB MOVE no Supabase remoto."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from load_app_env import load_app_env

ROOT = Path(__file__).resolve().parent.parent
PROJECT_REF = "grlkbtnwvxorlfglyzid"
QUERY_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

FISIOS: list[tuple[str, str, str | None]] = [
    ("Adriano de Lima Cezar", "adrianolimacezar@gmail.com", "368530-F"),
    ("Brenda Lacerda Farias", "lacerdabrenda21@gmail.com", "371627-F"),
    ("Camila Aguiar Pereira", "fisiocamilap@gmail.com", "140129-F"),
    ("Carlos Eduardo Moraes Oliveira", "moraes.cadu98@gmail.com", "355561-F"),
    ("Charlene Brito de Oliveira", "cbmoveneuro@gmail.com", "122334-F"),
    ("Daniele Martins Moraes", "danielemoraes2@gmail.com", "187872-F"),
    ("Diego Silveira de Paula Xavier", "diegoxavier.fisio@gmail.com", "5417831-F"),
    ("Fernanda Eduarda Pereira Ferreira", "fernandapereira.fisioterapia@gmail.com", "418545-F"),
    ("Gabriel Arrosi Fracaso", "gabrielarrosi@gmail.com", "406583-F"),
    ("Gabriel Romagna da Costa", "gabrielcoxta@gmail.com", "195779-F"),
    ("Gelson Leonardo dos Santos Klagenberg", "leoklagenberg@gmail.com", "366531-F"),
    ("Henrique Mollmann Pedrotti", "hiquepedrotti@gmail.com", "382900-F"),
    ("Kelen Silveira da Rosa", "kelensilveira4@gmail.com", "221255-F"),
    ("Leonardo Pires Batista", "leonardopb15@hotmail.com", None),
    ("Lorenzo Caon Da Silva", "lorenzocaon@gmail.com", "391561-F"),
    ("Lucas da Silva Santos", "fisiolucas.dsantos@gmail.com", "337354-F"),
    ("Mathias Mariani de Campos Velho Teixeira", "mathiasteixeira5@gmail.com", "420235-F"),
    ("Ohana Figueiredo Medeiros", "fisioterapiaohana@gmail.com", "346745-F"),
    ("Raisa Machado Alves", "raisa04@hotmail.com", "116873-F"),
    ("Rebeca Andrade de Mello", "rebecamello.a@gmail.com", "308344-F"),
    ("Rinaldo Pietrowski Pinto", "rinaldopietrowski@gmail.com", "221471-F"),
    ("Taiane dos Santos Soares", "taiane.soaress@hotmail.com", "300991-F"),
    ("Thales Escalante", "thales.escalante@gmail.com", "343809-F"),
    ("Vitória Vicenza Pedroso da Silva", "vicenzavitoria@gmail.com", None),
    ("William Vinícius Monteiro Pacheco", "williammonteiro1988@gmail.com", "312099-F"),
]

DEMO_SLOTS: list[tuple[str, int, str, str]] = [
    ("adrianolimacezar@gmail.com", 0, "2026-07-07T09:00:00-03:00", "confirmado"),
    ("lacerdabrenda21@gmail.com", 1, "2026-07-07T10:00:00-03:00", "agendado"),
    ("fisiocamilap@gmail.com", 2, "2026-07-07T11:00:00-03:00", "agendado"),
    ("adrianolimacezar@gmail.com", 3, "2026-07-08T09:00:00-03:00", "confirmado"),
    ("moraes.cadu98@gmail.com", 4, "2026-07-08T14:00:00-03:00", "agendado"),
    ("cbmoveneuro@gmail.com", 5, "2026-07-09T08:30:00-03:00", "agendado"),
    ("danielemoraes2@gmail.com", 6, "2026-07-09T10:30:00-03:00", "realizado"),
    ("diegoxavier.fisio@gmail.com", 7, "2026-07-09T15:00:00-03:00", "agendado"),
    ("fernandapereira.fisioterapia@gmail.com", 8, "2026-07-10T09:00:00-03:00", "confirmado"),
    ("gabrielarrosi@gmail.com", 9, "2026-07-10T11:00:00-03:00", "agendado"),
]


def _rest_headers(service_key: str, *, prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _rest_count(base: str, service_key: str, table: str) -> int:
    req = urllib.request.Request(
        f"{base}/rest/v1/{table}?select=id",
        headers=_rest_headers(service_key, prefer="count=exact"),
        method="GET",
    )
    req.add_header("Range", "0-0")
    with urllib.request.urlopen(req, timeout=30) as resp:
        content_range = resp.headers.get("Content-Range", "*/0")
        return int(content_range.split("/")[-1])


def apply_via_rest() -> None:
    base = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    if not key:
        raise RuntimeError("Defina SUPABASE_SERVICE_ROLE_KEY em .env.app")

    existing_req = urllib.request.Request(
        f"{base}/rest/v1/fisioterapeutas?select=email",
        headers=_rest_headers(key),
        method="GET",
    )
    with urllib.request.urlopen(existing_req, timeout=30) as resp:
        existing = {
            row["email"].lower()
            for row in json.loads(resp.read().decode())
            if row.get("email")
        }

    inserted = 0
    for nome, email, crefito in FISIOS:
        if email.lower() in existing:
            continue
        row: dict[str, object] = {"nome": nome, "email": email, "ativo": True}
        if crefito:
            row["registro_profissional"] = crefito
        req = urllib.request.Request(
            f"{base}/rest/v1/fisioterapeutas",
            data=json.dumps(row).encode(),
            method="POST",
            headers=_rest_headers(key, prefer="return=minimal"),
        )
        with urllib.request.urlopen(req, timeout=30):
            inserted += 1
    print(f"REST: {inserted} fisioterapeutas inseridos")

    if _rest_count(base, key, "agendamentos") > 0:
        print("REST: agendamentos já existem, demo ignorado")
        return

    fis_req = urllib.request.Request(
        f"{base}/rest/v1/fisioterapeutas?select=id,email",
        headers=_rest_headers(key),
        method="GET",
    )
    with urllib.request.urlopen(fis_req, timeout=30) as resp:
        fis_map = {
            row["email"].lower(): row["id"]
            for row in json.loads(resp.read().decode())
        }

    pac_req = urllib.request.Request(
        f"{base}/rest/v1/pacientes?select=id&ativo=eq.true&order=nome.asc&limit=10",
        headers=_rest_headers(key),
        method="GET",
    )
    with urllib.request.urlopen(pac_req, timeout=30) as resp:
        pacientes = json.loads(resp.read().decode())

    ag_inserted = 0
    for fisio_email, paciente_idx, inicio, status in DEMO_SLOTS:
        if paciente_idx >= len(pacientes):
            break
        row = {
            "paciente_id": pacientes[paciente_idx]["id"],
            "fisioterapeuta_id": fis_map[fisio_email.lower()],
            "inicio": inicio,
            "duracao_min": 50,
            "servico": "Fisioterapia",
            "status": status,
            "canal_origem": "seed",
        }
        req = urllib.request.Request(
            f"{base}/rest/v1/agendamentos",
            data=json.dumps(row).encode(),
            method="POST",
            headers=_rest_headers(key, prefer="return=minimal"),
        )
        with urllib.request.urlopen(req, timeout=30):
            ag_inserted += 1
    print(f"REST: {ag_inserted} agendamentos demo inseridos")


def apply_via_management_api(token: str) -> None:
    sql_file = ROOT / "scripts" / "seed-fisioterapeutas-cbmove.sql"
    sql = sql_file.read_text(encoding="utf-8")
    req = urllib.request.Request(
        QUERY_URL,
        data=json.dumps({"query": sql}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode()
        print("Management API:", resp.status)
        if body.strip():
            print(body[:2000])


def print_counts() -> None:
    base = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    print(
        f"Total: {_rest_count(base, key, 'fisioterapeutas')} fisioterapeutas, "
        f"{_rest_count(base, key, 'agendamentos')} agendamentos"
    )


def main() -> int:
    load_app_env()

    if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        print("Defina SUPABASE_SERVICE_ROLE_KEY em .env.app", file=sys.stderr)
        return 1

    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if token:
        try:
            apply_via_management_api(token)
            print_counts()
            return 0
        except urllib.error.HTTPError as e:
            print(
                f"Management API indisponível (HTTP {e.code}); usando service role REST…",
                file=sys.stderr,
            )

    try:
        apply_via_rest()
        print_counts()
        return 0
    except Exception as exc:
        print(f"Falha no seed via REST: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
