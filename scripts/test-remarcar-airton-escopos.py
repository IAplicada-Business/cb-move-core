#!/usr/bin/env python3
"""
Teste dos 3 escopos de remanejamento — Airton Tonelo, 16/07/26 08:00 → 17/07/26 08:00 (+1 dia).

  python scripts/test-remarcar-airton-escopos.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

# Reutiliza helpers do script de plano (nome com hífen)
import importlib.util

_plano_spec = importlib.util.spec_from_file_location(
    "test_plano", Path(__file__).parent / "test-plano-agenda-paciente.py"
)
_plano = importlib.util.module_from_spec(_plano_spec)
_plano_spec.loader.exec_module(_plano)

admin_headers = _plano.admin_headers
req = _plano.req
gerar_slots_plano = _plano.gerar_slots_plano
filtrar_faltantes = _plano.filtrar_faltantes

AIRTON = "bd0b5de4-0384-4418-9046-ecbd40310c25"
BRENDA = "5a9282af-0de7-4a85-9638-992a88f3b550"
ADMIN_EMAIL = "mariana@iaplicada.com"
MES, ANO = 7, 2026
DIAS_SEMANA = "2ª e 5ª (triplos)"
FREQ = "2x semana triplo"
HORAS_TRIPLO = ["08:00", "08:50", "09:40"]
ORIGEM_DATA = "2026-07-16"
NOVO_INICIO = "2026-07-17T08:00:00-03:00"

DIAS_PLANO = [2, 6, 9, 13, 16, 20, 23, 27]


def user_jwt(base: str) -> str:
    h = admin_headers()
    code, data = req("POST", f"{base}/auth/v1/admin/generate_link", h, {"type": "magiclink", "email": ADMIN_EMAIL})
    if code >= 400:
        raise RuntimeError(f"generate_link falhou ({code}): {data}")
    props = (data or {}).get("properties") or data or {}
    token_hash = props.get("hashed_token") or props.get("token_hash")
    anon = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    code2, sess = req(
        "POST",
        f"{base}/auth/v1/verify",
        {"apikey": anon, "Content-Type": "application/json"},
        {"type": "magiclink", "token_hash": token_hash},
    )
    if code2 >= 400:
        raise RuntimeError(f"verify falhou ({code2}): {sess}")
    token = (sess or {}).get("access_token")
    if not token:
        raise RuntimeError(f"verify sem access_token: {sess}")
    return token


def rpc(base: str, name: str, args: dict, jwt: str) -> tuple[int, object]:
    anon = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    h = {"apikey": anon, "Authorization": f"Bearer {jwt}", "Content-Type": "application/json"}
    return req("POST", f"{base}/rest/v1/rpc/{name}", h, args)


def get_json(base: str, path: str) -> list:
    code, data = req("GET", f"{base}/rest/v1/{path}", admin_headers())
    if code >= 400:
        raise RuntimeError(f"GET {path} → {code}: {data}")
    return data if isinstance(data, list) else []


def reset_airton(base: str) -> None:
    script = Path(__file__).parent / "limpar-agendamentos-teste.py"
    subprocess.run([sys.executable, str(script), "--apply"], check=True, capture_output=True)


def seed_plano(base: str) -> str:
    serie_id = str(uuid.uuid4())
    rows = []
    for dia in DIAS_PLANO:
        for hora in HORAS_TRIPLO:
            rows.append(
                {
                    "paciente_id": AIRTON,
                    "fisioterapeuta_id": BRENDA,
                    "inicio": f"2026-07-{dia:02d}T{hora}:00-03:00",
                    "duracao_min": 50,
                    "servico": "Fisioterapia neurológica",
                    "status": "agendado",
                    "serie_id": serie_id,
                    "canal_origem": "whatsapp",
                }
            )
    code, out = req("POST", f"{base}/rest/v1/agendamentos", admin_headers(), rows)
    if code >= 400:
        raise RuntimeError(f"insert agendamentos falhou ({code}): {out}")
    return serie_id


def fetch_agendamentos(base: str) -> list[dict]:
    inicio = f"{ANO}-{MES:02d}-01"
    fim = f"{ANO}-08-01"
    return get_json(
        base,
        "agendamentos?select=id,inicio,status,canal_origem,serie_id"
        f"&paciente_id=eq.{AIRTON}"
        f"&inicio=gte.{inicio}T00:00:00&inicio=lt.{fim}T00:00:00"
        "&order=inicio",
    )


def iso_week_key(inicio: str) -> str:
    # America/Sao_Paulo date from stored offset
    d = inicio[:10]
    y, m, day = map(int, d.split("-"))
    return f"{date(y, m, day).isocalendar().year}-W{date(y, m, day).isocalendar().week:02d}"


def contar_escopo(ags: list[dict], origem_id: str, escopo: str) -> int:
    origem = next(a for a in ags if a["id"] == origem_id)
    ativos = {"agendado", "confirmado", "realizado", "faltou"}
    origem_dt = origem["inicio"]
    origem_week = iso_week_key(origem_dt)
    origem_serie = origem.get("serie_id")
    fim_mes = f"{ANO}-{MES:02d}-31"

    if escopo == "pontual":
        return 1

    count = 0
    for ag in ags:
        if ag["status"] not in ativos:
            continue
        if ag["inicio"] < origem_dt:
            continue
        if origem_serie and ag.get("serie_id") != origem_serie:
            continue
        if escopo == "semana":
            if iso_week_key(ag["inicio"]) != origem_week:
                continue
        elif escopo == "serie_mes":
            if ag["inicio"][:10] > fim_mes:
                continue
        else:
            raise ValueError(escopo)
        count += 1
    return count


def resumo_datas(ags: list[dict], *, apenas_ativos: bool = True) -> Counter:
    ativos = {"agendado", "confirmado", "realizado", "faltou"}
    c: Counter = Counter()
    for ag in ags:
        if apenas_ativos and ag["status"] not in ativos:
            continue
        c[ag["inicio"][:10]] += 1
    return c


def faltantes_plano(ags: list[dict]) -> int:
    ativos = [a for a in ags if a["status"] in ("agendado", "confirmado", "realizado", "faltou")]
    slots = gerar_slots_plano(MES, ANO, 24, DIAS_SEMANA, FREQ)
    return len(filtrar_faltantes(slots, ativos))


def origem_16_08(base: str) -> dict:
    rows = get_json(
        base,
        "agendamentos?select=id,inicio,status,serie_id"
        f"&paciente_id=eq.{AIRTON}"
        f"&inicio=gte.2026-07-16&inicio=lt.2026-07-17"
        "&status=eq.agendado&order=inicio&limit=1",
    )
    if not rows:
        raise RuntimeError("Agendamento 16/07 08:00 não encontrado")
    return rows[0]


def testar_escopo(base: str, jwt: str, escopo: str, label: str, esperado: int) -> bool:
    print(f"\n{'=' * 60}")
    print(f"ESCOPO: {label} ({escopo}) — esperado: {esperado} horário(s)")
    print("=" * 60)

    reset_airton(base)
    serie_id = seed_plano(base)
    print(f"Plano limpo criado: 24 agendamentos, série {serie_id[:8]}…")

    origem = origem_16_08(base)
    ags_antes = fetch_agendamentos(base)
    contagem = contar_escopo(ags_antes, origem["id"], escopo)
    print(f"Contagem prévia (espelha UI): {contagem}")
    if contagem != esperado:
        print(f"  AVISO: contagem {contagem} != esperado {esperado}")

    code, out = rpc(
        base,
        "remarcar_agendamentos_lote",
        {
            "p_agendamento_id": origem["id"],
            "p_novo_inicio": NOVO_INICIO,
            "p_escopo": escopo,
        },
        jwt,
    )
    if code >= 400:
        print(f"FALHA RPC ({code}): {out}")
        return False

    print(f"RPC OK: {json.dumps(out, ensure_ascii=False)}")

    ags = fetch_agendamentos(base)
    remarcados = [a for a in ags if a["status"] == "remarcacao"]
    novos = [a for a in ags if a.get("canal_origem") == "remanejamento"]
    ativos = resumo_datas(ags)
    falt = faltantes_plano(ags)

    count_rpc = (out or {}).get("count", 0)
    ok = count_rpc == esperado
    print(f"\nResultado:")
    print(f"  remarcados (status=remarcacao): {len(remarcados)}")
    print(f"  novos (canal=remanejamento):    {len(novos)}")
    print(f"  RPC count:                      {count_rpc} {'OK' if ok else 'FALHA'}")
    print(f"  faltantes no plano (slots):     {falt}")
    print(f"  distribuição ativos por data:")
    for d in sorted(ativos):
        wd = date(*map(int, d.split("-"))).strftime("%a")
        print(f"    {d} ({wd}): {ativos[d]}x")

    if escopo == "pontual":
        ok = ok and len(remarcados) == 1 and ativos.get("2026-07-16", 0) == 2 and ativos.get("2026-07-17", 0) == 1
    elif escopo == "semana":
        ok = ok and len(remarcados) == 3 and ativos.get("2026-07-16", 0) == 0 and ativos.get("2026-07-17", 0) == 3
    elif escopo == "serie_mes":
        esperado_datas = {"2026-07-17": 3, "2026-07-21": 3, "2026-07-24": 3, "2026-07-28": 3}
        ok = ok and len(remarcados) == 12 and all(ativos.get(d, 0) == n for d, n in esperado_datas.items())
        ok = ok and ativos.get("2026-07-16", 0) == 0 and ativos.get("2026-07-20", 0) == 0

    print(f"  validação geral: {'PASSOU' if ok else 'FALHOU'}")
    return ok


def main() -> int:
    load_app_env()
    base = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    jwt = user_jwt(base)

    casos = [
        ("pontual", "Só este horário", 1),
        ("semana", "Demais futuros na mesma semana", 3),
        ("serie_mes", "Demais futuros até fim do mês", 12),
    ]

    resultados: list[tuple[str, bool]] = []
    for escopo, label, esperado in casos:
        resultados.append((label, testar_escopo(base, jwt, escopo, label, esperado)))

    print(f"\n{'=' * 60}")
    print("RESUMO")
    print("=" * 60)
    all_ok = True
    for label, ok in resultados:
        status = "OK" if ok else "FALHA"
        print(f"  [{status}] {label}")
        all_ok = all_ok and ok

    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
