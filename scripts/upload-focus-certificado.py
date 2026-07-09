#!/usr/bin/env python3
"""Envia certificado A1 (.p12) para a empresa na Focus NFe via API.

Lê credenciais de .env.app — nunca commitar senha ou arquivo .p12.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

from load_app_env import load_app_env

FOCUS_API = "https://api.focusnfe.com.br"


def basic_auth_header(token: str) -> str:
    import base64 as b64

    raw = f"{token}:".encode()
    return "Basic " + b64.b64encode(raw).decode()


def focus_request(
    token: str,
    method: str,
    path: str,
    body: dict | None = None,
) -> dict:
    url = f"{FOCUS_API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": basic_auth_header(token),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            text = res.read().decode()
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        try:
            parsed = json.loads(detail)
            msg = parsed.get("mensagem") or parsed.get("erro") or parsed
        except Exception:
            msg = detail[:500]
        raise RuntimeError(f"Focus HTTP {e.code}: {msg}") from e


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload certificado A1 Focus NFe")
    parser.add_argument("--dry-run", action="store_true", help="Valida sem gravar")
    parser.add_argument("--empresa-id", default=os.environ.get("FOCUSNFE_EMPRESA_ID", "230418"))
    args = parser.parse_args()

    load_app_env()

    token = os.environ.get("FOCUSNFE_REVENDA_TOKEN") or os.environ.get("FOCUSNFE_TOKEN")
    if not token:
        print("Defina FOCUSNFE_TOKEN ou FOCUSNFE_REVENDA_TOKEN em .env.app", file=sys.stderr)
        sys.exit(1)

    cert_path = os.environ.get("FOCUSNFE_CERTIFICADO_PATH", "docs/3EB06B03F808BDAED2ECF0.p12")
    cert_senha = os.environ.get("FOCUSNFE_CERTIFICADO_SENHA")
    if not cert_senha:
        print("Defina FOCUSNFE_CERTIFICADO_SENHA em .env.app", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(cert_path):
        print(f"Certificado não encontrado: {cert_path}", file=sys.stderr)
        sys.exit(1)

    with open(cert_path, "rb") as f:
        cert_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "arquivo_certificado_base64": cert_b64,
        "senha_certificado": cert_senha,
        "certificado_especifico": True,
    }
    if args.dry_run:
        payload["dry_run"] = True

    print(f"Empresa Focus ID: {args.empresa_id}")
    print(f"Certificado: {cert_path} ({os.path.getsize(cert_path)} bytes)")
    if args.dry_run:
        print("Modo dry-run — validando…")

    result = focus_request(
        token,
        "PATCH",
        f"/v2/empresas/{args.empresa_id}",
        payload,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False)[:2000])

    empresa = focus_request(token, "GET", f"/v2/empresas/{args.empresa_id}")
    valido_de = empresa.get("certificado_valido_de")
    valido_ate = empresa.get("certificado_valido_ate")
    print(f"Certificado válido: {valido_de} → {valido_ate}")


if __name__ == "__main__":
    main()
