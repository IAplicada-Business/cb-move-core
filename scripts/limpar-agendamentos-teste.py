#!/usr/bin/env python3
"""
Remove agendamentos criados durante testes de desenvolvimento (jul/2026).

Critérios (OR):
  - canal_origem = test_atomic_remarcar
  - serie_id dos lotes de teste do Airton (bulk dias_semana + mesmo dia semana)
  - todos os agendamentos do Airton Tonelo em jul/2026 (mês montado só para teste)
  - paciente "Cliente Teste" / nome ilike '%teste%' com inicio em jul/2026

Uso:
  python scripts/limpar-agendamentos-teste.py --dry-run
  python scripts/limpar-agendamentos-teste.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

# Lotes identificados na investigação do Airton (14/07/2026)
SERIES_TESTE = {
    "7ac4156f-db7f-413f-b40d-6dc33f576072",
    "39a824a0-300a-40d5-abcb-7de4146cf7a4",
}
TEST_CANAL = "test_atomic_remarcar"
SERVICO_TESTE_REMARCAR = "Teste atomicidade remarcar"
AIRTON_NOME = "Airton Tonelo"
MES = 7
ANO = 2026


def req(method: str, url: str, headers: dict, body=None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as res:
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


def get_json(base: str, h: dict, path: str) -> list:
    code, data = req("GET", f"{base}/rest/v1/{path}", h)
    if code >= 400:
        raise RuntimeError(f"GET {path} → {code}: {data}")
    return data if isinstance(data, list) else []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Executa a exclusão (padrão: dry-run)")
    args = parser.parse_args()

    load_app_env()
    base = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    if not base.startswith("http"):
        print("SUPABASE_URL ausente", file=sys.stderr)
        return 1

    h = admin_headers()
    inicio = f"{ANO}-{MES:02d}-01"
    fim = f"{ANO}-08-01" if MES == 7 else f"{ANO}-{MES+1:02d}-01"

    # Pacientes alvo
    paciente_ids: set[str] = set()
    nome_q = urllib.parse.quote(f"%{AIRTON_NOME}%")
    for p in get_json(base, h, f"pacientes?select=id,nome&nome=ilike.{nome_q}"):
        paciente_ids.add(p["id"])
        print(f"Paciente alvo: {p['nome']} ({p['id']})")

    teste_q = urllib.parse.quote("%teste%")
    for p in get_json(base, h, f"pacientes?select=id,nome&nome=ilike.{teste_q}&ativo=eq.true"):
        paciente_ids.add(p["id"])
        print(f"Paciente teste: {p['nome']} ({p['id']})")

    # Agendamentos jul/2026
    ags = get_json(
        base,
        h,
        "agendamentos?select=id,inicio,status,paciente_id,serie_id,canal_origem,servico,pacientes(nome)"
        f"&inicio=gte.{inicio}T00:00:00&inicio=lt.{fim}T00:00:00"
        "&order=inicio",
    )

    to_delete: list[dict] = []
    reasons: dict[str, str] = {}

    for ag in ags:
        ag_id = ag["id"]
        motivos: list[str] = []

        if ag.get("canal_origem") == TEST_CANAL:
            motivos.append("canal test_atomic_remarcar")

        if (ag.get("servico") or "").strip() == SERVICO_TESTE_REMARCAR:
            motivos.append("servico teste remarcar RPC")

        sid = ag.get("serie_id")
        if sid in SERIES_TESTE:
            motivos.append(f"serie teste {sid[:8]}")

        pid = ag.get("paciente_id")
        if pid in paciente_ids:
            nome = (ag.get("pacientes") or {}).get("nome") or pid
            if AIRTON_NOME.lower() in (nome or "").lower():
                motivos.append("Airton jul/2026")
            else:
                motivos.append(f"paciente teste ({nome})")

        if motivos:
            to_delete.append(ag)
            reasons[ag_id] = ", ".join(motivos)

    # Sobras do test-remarcar-atomic (servico fixo, qualquer mês)
    svc_q = urllib.parse.quote(SERVICO_TESTE_REMARCAR)
    remarcar_teste = get_json(
        base,
        h,
        f"agendamentos?select=id,inicio,status,paciente_id,serie_id,canal_origem,servico,pacientes(nome)&servico=eq.{svc_q}",
    )
    for ag in remarcar_teste:
        if ag["id"] not in reasons:
            to_delete.append(ag)
            reasons[ag["id"]] = "servico teste remarcar RPC (global)"

    # Deduplicate by id
    seen: set[str] = set()
    unique: list[dict] = []
    for ag in to_delete:
        if ag["id"] not in seen:
            seen.add(ag["id"])
            unique.append(ag)

    print(f"\n=== Limpeza agendamentos de teste ({MES:02d}/{ANO}) ===")
    print(f"Total no mês: {len(ags)}")
    print(f"A remover: {len(unique)}")
    print(f"Modo: {'APPLY' if args.apply else 'DRY-RUN'}\n")

    by_motivo: dict[str, int] = {}
    by_paciente: dict[str, int] = {}
    for ag in sorted(unique, key=lambda a: a["inicio"]):
        nome = (ag.get("pacientes") or {}).get("nome") or "(sem paciente)"
        mot = reasons[ag["id"]]
        by_motivo[mot] = by_motivo.get(mot, 0) + 1
        by_paciente[nome] = by_paciente.get(nome, 0) + 1
        print(f"  · {ag['inicio'][:16]} | {nome[:30]} | {ag['status']} | {mot}")

    print("\nPor paciente:")
    for nome, n in sorted(by_paciente.items(), key=lambda x: -x[1]):
        print(f"  {nome}: {n}")

    if not unique:
        print("\nNada a remover.")
        return 0

    if not args.apply:
        print("\nDry-run — use --apply para excluir.")
        return 0

    ids = ",".join(a["id"] for a in unique)
    code, res = req("DELETE", f"{base}/rest/v1/agendamentos?id=in.({ids})", h)
    if code >= 400:
        print(f"\nERRO ao excluir ({code}): {res}", file=sys.stderr)
        return 1

    # Verifica remanescentes do teste
    restantes = get_json(
        base,
        h,
        "agendamentos?select=id&canal_origem=eq." + TEST_CANAL,
    )
    if restantes:
        code2, _ = req(
            "DELETE",
            f"{base}/rest/v1/agendamentos?canal_origem=eq.{TEST_CANAL}",
            h,
        )
        print(f"Removidos extras canal teste: {len(restantes)} (HTTP {code2})")

    print(f"\nOK — {len(unique)} agendamentos removidos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
