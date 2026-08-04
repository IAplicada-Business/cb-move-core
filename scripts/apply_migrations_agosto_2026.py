#!/usr/bin/env python3
"""Aplica migrations reajuste ago/2026 e desativar fisio teste."""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env
from audit_retroativos import Supa


def patch(sb: Supa, table: str, filt: str, body: dict) -> list:
    path = f"{table}?{filt}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{sb.url}/rest/v1/{urllib.parse.quote(path, safe='/?&=(),.*:_-')}",
        data=data,
        headers={
            "apikey": sb.key,
            "Authorization": f"Bearer {sb.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        raw = res.read().decode()
        return json.loads(raw) if raw else []


def main() -> int:
    load_app_env()
    sb = Supa()

    before_m = sb.fetch_all("pacientes", "id,valor_mensal", "valor_mensal=eq.1028")
    before_s = sb.fetch_all("pacientes", "id,valor_sessao", "valor_sessao=eq.266")
    before_f = sb.fetch_all(
        "fisioterapeutas", "id,nome,ativo", "nome=ilike.*Fisio Teste CBMove*"
    )

    m = patch(sb, "pacientes", "valor_mensal=eq.1028", {"valor_mensal": 1110})
    s = patch(sb, "pacientes", "valor_sessao=eq.266", {"valor_sessao": 287})
    f = patch(sb, "fisioterapeutas", "nome=ilike.*Fisio Teste CBMove*", {"ativo": False})

    print(f"reajuste mensalista: {len(before_m)} pacientes -> {len(m)} atualizados")
    print(f"reajuste sessao: {len(before_s)} pacientes -> {len(s)} atualizados")
    print(f"fisio teste: {len(before_f)} registro(s) -> {len(f)} desativado(s)")
    for row in f:
        print(f"  {row['nome']} ativo={row['ativo']}")

    after_m = sb.fetch_all("pacientes", "id", "valor_mensal=eq.1110")
    after_s = sb.fetch_all("pacientes", "id", "valor_sessao=eq.287")
    print(f"\nvalidacao: {len(after_m)} com valor_mensal=1110, {len(after_s)} com valor_sessao=287")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
