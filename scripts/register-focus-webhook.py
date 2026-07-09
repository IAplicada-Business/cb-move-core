#!/usr/bin/env python3
"""Registra webhook nfsen na Focus NFe e grava secret no Supabase."""
from __future__ import annotations

import base64
import json
import os
import secrets
import sys
import urllib.error
import urllib.request

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"


def basic_auth(token: str) -> str:
    return "Basic " + base64.b64encode(f"{token}:".encode()).decode()


def focus_base(ambiente: str) -> str:
    return (
        "https://homologacao.focusnfe.com.br"
        if ambiente == "homologacao"
        else "https://api.focusnfe.com.br"
    )


def focus_request(token: str, ambiente: str, method: str, path: str, body: dict | None = None) -> object:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        focus_base(ambiente) + path,
        data=data,
        headers={
            "Authorization": basic_auth(token),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = raw
        raise RuntimeError(f"Focus {e.code}: {payload}") from e


def upsert_config(chave: str, valor: str) -> None:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = [{"chave": chave, "valor": valor}]
    req = urllib.request.Request(
        f"{base}/rest/v1/integracao_config?on_conflict=chave",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        res.read()


def apply_migration_processando() -> None:
    migration = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "supabase",
        "migrations",
        "20260709180000_nf_status_processando.sql",
    )
    if not os.path.isfile(migration):
        print("Migration processando não encontrada — pule se já aplicada.")
        return
    print("Aplique a migration:", migration)


def main() -> None:
    load_app_env()
    token = os.environ.get("FOCUSNFE_TOKEN")
    cnpj = "".join(c for c in os.environ.get("FOCUSNFE_CNPJ_PRESTADOR", "42082795000174") if c.isdigit())
    ambiente = os.environ.get("FOCUSNFE_AMBIENTE", "homologacao")

    if not token:
        print("Defina FOCUSNFE_TOKEN em .env.app", file=sys.stderr)
        sys.exit(1)
    if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        print("Defina SUPABASE_SERVICE_ROLE_KEY em .env.app", file=sys.stderr)
        sys.exit(1)

    apply_migration_processando()

    secret = os.environ.get("FOCUSNFE_WEBHOOK_SECRET") or secrets.token_urlsafe(32)
    webhook_url = (
        os.environ.get("FOCUSNFE_WEBHOOK_URL")
        or f"https://{PROJECT_REF}.supabase.co/functions/v1/focus-nfe-webhook"
    )

    upsert_config("FOCUSNFE_WEBHOOK_SECRET", secret)
    print(f"FOCUSNFE_WEBHOOK_SECRET gravado ({secret[:6]}…)")

    hooks = focus_request(token, ambiente, "GET", "/v2/hooks")
    if isinstance(hooks, list):
        for hook in hooks:
            if (
                hook.get("event") == "nfsen"
                and hook.get("cnpj") == cnpj
                and hook.get("url") == webhook_url
            ):
                print(f"Webhook nfsen já registrado (id={hook.get('id')})")
                print(f"URL: {webhook_url}")
                return

    created = focus_request(
        token,
        ambiente,
        "POST",
        "/v2/hooks",
        {
            "cnpj": cnpj,
            "event": "nfsen",
            "url": webhook_url,
            "authorization": secret,
            "authorization_header": "X-Webhook-Secret",
        },
    )
    print("Webhook nfsen criado:", json.dumps(created, ensure_ascii=False))
    print(f"URL: {webhook_url}")


if __name__ == "__main__":
    main()
