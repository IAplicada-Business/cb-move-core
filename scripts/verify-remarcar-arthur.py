#!/usr/bin/env python3
"""Verifica remarcação recente de Arthur Borba Tavares em jul/2026."""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env


def get(path: str) -> list | dict:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    url = f"{base}/rest/v1/{path}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def main() -> None:
    load_app_env()
    nome = urllib.parse.quote("Arthur Borba Tavares")
    pacs = get(f"pacientes?nome=eq.{nome}&select=id,nome,frequencia_atendimento,dias_semana")
    if not pacs:
        print("Paciente não encontrado")
        return

    pac = pacs[0]
    pid = pac["id"]
    print("PACIENTE:", json.dumps(pac, ensure_ascii=False, indent=2))

    ags = get(
        f"agendamentos?paciente_id=eq.{pid}"
        f"&inicio=gte.2026-07-01&inicio=lt.2026-08-01"
        f"&select=id,inicio,status,remarcado_de_id,remarcado_para_id,fisioterapeuta_id"
        f"&order=inicio.asc"
    )
    print("\nAGENDAMENTOS_JUL:", json.dumps(ags, ensure_ascii=False, indent=2))

    remarcados = [a for a in ags if a.get("status") == "remarcacao" or a.get("remarcado_de_id")]
    print("\nPAR_REMARCACAO:")
    for a in remarcados:
        print(json.dumps(a, ensure_ascii=False))

    hist = get(
        "agendamento_historico?acao=eq.remanejamento"
        "&select=agendamento_id,acao,inicio_anterior,inicio_novo,escopo,created_at"
        "&order=created_at.desc&limit=15"
    )
    ag_ids = {a["id"] for a in ags}
    hist_pac = [h for h in hist if h.get("agendamento_id") in ag_ids]
    print("\nHISTORICO_REMARCACAO_PACIENTE:", json.dumps(hist_pac, ensure_ascii=False, indent=2))

    # Verificação esperada 15/07 → 22/07
    old_15 = [a for a in ags if str(a.get("inicio", "")).startswith("2026-07-15")]
    new_22 = [a for a in ags if str(a.get("inicio", "")).startswith("2026-07-22") and a.get("status") == "agendado"]
    print("\nCHECK_15_07:", json.dumps(old_15, ensure_ascii=False))
    print("CHECK_22_07:", json.dumps(new_22, ensure_ascii=False))


if __name__ == "__main__":
    main()
