#!/usr/bin/env python3
"""Teste pontual: Airton 16/07 08:00 → 17/07 08:00 (escopo pontual)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

AIRTON = "bd0b5de4-0384-4418-9046-ecbd40310c25"
ADMIN_EMAIL = "mariana@iaplicada.com"


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


def main() -> int:
    load_app_env()
    base = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    h = admin_headers()
    jwt = user_jwt(base)

    url = (
        f"{base}/rest/v1/agendamentos?select=id,inicio,status"
        f"&paciente_id=eq.{AIRTON}"
        f"&inicio=gte.2026-07-16T11:00:00&inicio=lt.2026-07-16T12:00:00"
        f"&status=eq.agendado&order=inicio&limit=1"
    )
    rows = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=h)).read())
    if not rows:
        print("Agendamento 16/07 08:00 não encontrado", file=sys.stderr)
        return 1

    ag_id = rows[0]["id"]
    print(f"Antes: {rows[0]['inicio']} ({rows[0]['status']}) id={ag_id[:8]}…")

    code, out = rpc(
        base,
        "remarcar_agendamentos_lote",
        {
            "p_agendamento_id": ag_id,
            "p_novo_inicio": "2026-07-17T08:00:00-03:00",
            "p_escopo": "pontual",
        },
        jwt,
    )
    if code >= 400:
        print(f"RPC falhou ({code}): {out}", file=sys.stderr)
        return 1

    print(f"RPC OK: {json.dumps(out, ensure_ascii=False)}")

    url2 = (
        f"{base}/rest/v1/agendamentos?select=id,inicio,status,canal_origem"
        f"&paciente_id=eq.{AIRTON}"
        f"&inicio=gte.2026-07-16T00:00:00&inicio=lt.2026-07-18T00:00:00"
        f"&order=inicio"
    )
    rows2 = json.loads(urllib.request.urlopen(urllib.request.Request(url2, headers=h)).read())
    print("\n16–17/07 após remarcação:")
    for r in rows2:
        print(f"  {r['inicio'][:19]}  {r['status']:12}  {r.get('canal_origem') or '—'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
