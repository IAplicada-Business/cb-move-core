#!/usr/bin/env python3
"""Valida send-boleto-cobranca: dedup, canais e cobrancas_envios."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from load_app_env import load_app_env

ADMIN_EMAIL = "mariana@iaplicada.com"


def req(method: str, url: str, headers: dict, body: dict | None = None) -> tuple[int, dict | str | list]:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as res:
            raw = res.read().decode()
            try:
                return res.status, json.loads(raw)
            except json.JSONDecodeError:
                return res.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def admin_headers() -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def user_jwt(base: str, email: str) -> str:
    h = admin_headers()
    code, data = req("POST", f"{base}/auth/v1/admin/generate_link", h, {"type": "magiclink", "email": email})
    if code >= 400:
        raise RuntimeError(f"generate_link falhou ({code}): {data}")
    props = data.get("properties") or data
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
    token = sess.get("access_token")
    if not token:
        raise RuntimeError(f"verify sem access_token: {sess}")
    return token


def find_cobranca_com_boleto(base: str, h: dict) -> dict | None:
    url = (
        f"{base}/rest/v1/cobrancas"
        "?select=id,boleto_url,forma_pagamento,pacientes(email,telefone)"
        "&boleto_url=not.is.null"
        "&status=neq.pago&status=neq.cancelado"
        "&limit=1"
    )
    code, rows = req("GET", url, h)
    if code >= 400 or not rows:
        return None
    return rows[0]


def invoke_send(base: str, anon: str, jwt: str, cobranca_id: str) -> tuple[int, dict]:
    code, data = req(
        "POST",
        f"{base}/functions/v1/send-boleto-cobranca",
        {"apikey": anon, "Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
        {"cobranca_id": cobranca_id, "event_id": f"boleto-docs-{cobranca_id}"},
    )
    if isinstance(data, dict):
        return code, data
    return code, {"raw": data}


def main() -> None:
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    anon = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
    svc = admin_headers()

    print("1) Verificar tabela cobrancas_envios…")
    code, _ = req("GET", f"{base}/rest/v1/cobrancas_envios?select=id&limit=1", svc)
    if code >= 400:
        print(f"   FALHA ({code}) — migration não aplicada?", file=sys.stderr)
        sys.exit(1)
    print("   OK")

    print("2) Buscar cobrança com boleto_url…")
    cob = find_cobranca_com_boleto(base, svc)
    if not cob:
        print("   Nenhuma cobrança com boleto — pule envio/dedup", file=sys.stderr)
        sys.exit(0)
    cid = cob["id"]
    print(f"   {cid} forma_pagamento={cob.get('forma_pagamento')}")

    print("3) JWT usuário financeiro…")
    jwt = user_jwt(base, ADMIN_EMAIL)

    print("4) Primeiro envio send-boleto-cobranca…")
    code1, res1 = invoke_send(base, anon, jwt, cid)
    print(f"   HTTP {code1}: {json.dumps(res1, ensure_ascii=False)}")
    if code1 == 501:
        print("   Webhook n8n não configurado — dedup não testável sem primeiro envio OK")
        sys.exit(0)
    if code1 >= 400:
        sys.exit(1)

    print("5) Segundo envio (dedup esperado)…")
    code2, res2 = invoke_send(base, anon, jwt, cid)
    print(f"   HTTP {code2}: {json.dumps(res2, ensure_ascii=False)}")
    if code2 >= 400:
        sys.exit(1)
    if not res2.get("duplicate"):
        print("   FALHA: segundo envio deveria retornar duplicate=true", file=sys.stderr)
        sys.exit(1)
    print("   OK duplicate=true")

    print("6) Registro em cobrancas_envios…")
    code3, rows = req(
        "GET",
        f"{base}/rest/v1/cobrancas_envios?cobranca_id=eq.{cid}&event_id=eq.boleto-docs-{cid}&select=id,canais",
        svc,
    )
    if code3 >= 400 or not rows:
        print(f"   FALHA ({code3}): sem registro de auditoria", file=sys.stderr)
        sys.exit(1)
    print(f"   OK canais={rows[0].get('canais')}")
    print("\nValidação E2E concluída.")


if __name__ == "__main__":
    main()
