#!/usr/bin/env python3
"""
Testa token mTLS Cora (Integração Direta) conforme documentação oficial.

POST https://matls-clients.api.stage.cora.com.br/token
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials&client_id={client_id}
mTLS: certificate.pem + private-key.key

@see https://developers.cora.com.br/docs/client-credentials-int-direta
"""
from __future__ import annotations

import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

ROOT = Path(__file__).resolve().parent.parent
TOKEN_URL = "https://matls-clients.api.stage.cora.com.br/token"


def main() -> None:
    load_app_env()
    client_id = (os.environ.get("CORA_CLIENT_ID") or "").strip()
    cert_path = os.environ.get("CORA_CERTIFICATE_PATH", "").strip()
    key_path = os.environ.get("CORA_PRIVATE_KEY_PATH", "").strip()

    if not client_id or not cert_path or not key_path:
        print("Defina CORA_CLIENT_ID, CORA_CERTIFICATE_PATH e CORA_PRIVATE_KEY_PATH em .env.app")
        sys.exit(1)

    cert = (ROOT / cert_path).resolve() if not Path(cert_path).is_absolute() else Path(cert_path)
    key = (ROOT / key_path).resolve() if not Path(key_path).is_absolute() else Path(key_path)

    ctx = ssl.create_default_context()
    ctx.load_cert_chain(certfile=str(cert), keyfile=str(key))
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    body = urllib.parse.urlencode(
        {"grant_type": "client_credentials", "client_id": client_id}
    ).encode()

    req = urllib.request.Request(
        TOKEN_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    print(f"Client ID: {client_id}")
    print(f"Cert: {cert}")
    print(f"Key:  {key}")
    print(f"POST {TOKEN_URL}")

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as res:
            raw = res.read().decode()
            print(f"OK HTTP {res.status}")
            print(raw[:400])
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        print(f"FALHA HTTP {e.code}: {detail}")
        if e.code == 401:
            print(
                "\n401 — credenciais recusadas pelo Cora. Conferir:\n"
                "  • certificate.pem + private-key.key do mesmo zip (ambiente STAGE)\n"
                "  • Client ID igual ao CN do certificado e ao painel Cora\n"
                "  • Etapa de autorização da Integração Direta concluída no Cora Web\n"
                "  • docs: https://developers.cora.com.br/docs/client-credentials-int-direta"
            )
        sys.exit(1)


if __name__ == "__main__":
    main()
