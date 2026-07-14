#!/usr/bin/env python3
"""Simula o clique em 'Enviar boleto' da UI (emitBoletoCora + edge emit-boleto-cora)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from load_app_env import load_app_env

COBRANCA_ID = "b0bea120-9c4f-41d7-8722-e2dd755648d1"
ADMIN_EMAIL = "mariana@iaplicada.com"


def req(method: str, url: str, headers: dict, body: dict | None = None) -> tuple[int, dict | str]:
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


def main() -> None:
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    anon = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]

    print("1) Sessão de usuário admin (como navegador logado)…")
    jwt = user_jwt(base, ADMIN_EMAIL)
    print("   JWT OK")

    auth_h = {
        "apikey": anon,
        "Authorization": f"Bearer {jwt}",
        "Content-Type": "application/json",
    }

    print("2) updateCobranca forma_pagamento=boleto (como emitBoletoCora)…")
    code, row = req(
        "GET",
        f"{base}/rest/v1/cobrancas?id=eq.{COBRANCA_ID}&select=id,valor,vencimento,status,boleto_url,pacientes(cpf,email)",
        auth_h,
    )
    if code >= 400 or not row:
        print(f"   ERRO load cobrança ({code}): {row}", file=sys.stderr)
        sys.exit(1)
    cob = row[0]
    pac = cob.get("pacientes") or {}
    print(f"   Paciente CPF={pac.get('cpf')} email={pac.get('email')}")
    print(f"   Cobrança R$ {cob['valor']} venc {cob['vencimento']} boleto_url={'sim' if cob.get('boleto_url') else 'não'}")

    code, patched = req(
        "PATCH",
        f"{base}/rest/v1/cobrancas?id=eq.{COBRANCA_ID}",
        {**auth_h, "Prefer": "return=minimal"},
        {"forma_pagamento": "boleto"},
    )
    if code >= 400:
        print(f"   ERRO patch ({code}): {patched}", file=sys.stderr)
        sys.exit(1)
    print("   PATCH OK")

    print("3) supabase.functions.invoke('emit-boleto-cora')…")
    code, result = req(
        "POST",
        f"{base}/functions/v1/emit-boleto-cora",
        auth_h,
        {"cobranca_id": COBRANCA_ID},
    )
    print(f"   HTTP {code}")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if code >= 400 or (isinstance(result, dict) and result.get("error")):
        sys.exit(1)

    print("\nSUCESSO — mesmo fluxo do botão 'Enviar boleto' na UI.")


if __name__ == "__main__":
    main()
