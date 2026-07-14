#!/usr/bin/env python3
"""Aplica credenciais Cora (Integração Direta mTLS) em integracao_config."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from load_app_env import load_app_env

STAGE_MTLS_BASE = "https://matls-clients.api.stage.cora.com.br"
PROD_MTLS_BASE = "https://matls-clients.api.cora.com.br"
ROOT = Path(__file__).resolve().parent.parent


def upsert_config(base: str, rows: list[tuple[str, str]]) -> None:
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = [{"chave": chave, "valor": valor} for chave, valor in rows]
    req = urllib.request.Request(
        f"{base}/rest/v1/integracao_config?on_conflict=chave",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        res.read()


def read_pem(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    if "BEGIN" not in text:
        raise ValueError(f"Arquivo PEM inválido: {path}")
    return text


def certificate_cn(cert_pem: str) -> str | None:
    try:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend

        cert = x509.load_pem_x509_certificate(cert_pem.encode(), default_backend())
        for attr in cert.subject:
            if attr.oid.dotted_string == "2.5.4.3":  # commonName
                return attr.value
    except Exception:
        return None
    return None


def resolve_path(raw: str) -> Path:
    path = Path(raw.strip().strip("\"'"))
    if not path.is_absolute():
        path = ROOT / path
    return path.resolve()


def load_from_env() -> tuple[str, Path, Path, str]:
    client_id = (os.environ.get("CORA_CLIENT_ID") or "").strip()
    cert_path = (os.environ.get("CORA_CERTIFICATE_PATH") or "").strip()
    key_path = (os.environ.get("CORA_PRIVATE_KEY_PATH") or "").strip()
    ambiente = (os.environ.get("CORA_AMBIENTE") or "stage").strip().lower()

    missing = []
    if not client_id:
        missing.append("CORA_CLIENT_ID")
    if not cert_path:
        missing.append("CORA_CERTIFICATE_PATH")
    if not key_path:
        missing.append("CORA_PRIVATE_KEY_PATH")
    if missing:
        print(f"Defina em .env.app: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    if ambiente not in ("stage", "production"):
        print("CORA_AMBIENTE deve ser 'stage' ou 'production'", file=sys.stderr)
        sys.exit(1)

    return client_id, resolve_path(cert_path), resolve_path(key_path), ambiente


def main() -> None:
    parser = argparse.ArgumentParser(description="Grava credenciais Cora no Supabase.")
    parser.add_argument("--from-env", action="store_true", help="Lê CORA_* de .env.app")
    parser.add_argument("--client-id", help="Client ID do Cora (int-...)")
    parser.add_argument("--certificate", type=Path, help="certificate.pem")
    parser.add_argument("--private-key", type=Path, help="private-key.key")
    parser.add_argument(
        "--ambiente",
        choices=("stage", "production"),
        help="stage = matls-clients.api.stage.cora.com.br",
    )
    args = parser.parse_args()

    load_app_env()
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not os.environ.get(k)]
    if missing:
        print(f"Defina em .env.app: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    if args.from_env or not (args.client_id and args.certificate and args.private_key):
        client_id, cert_path, key_path, ambiente = load_from_env()
    else:
        client_id = args.client_id.strip()
        cert_path = args.certificate.resolve()
        key_path = args.private_key.resolve()
        ambiente = args.ambiente or (os.environ.get("CORA_AMBIENTE") or "stage").strip().lower()

    api_base = (os.environ.get("CORA_API_BASE") or "").strip()
    if not api_base:
        api_base = STAGE_MTLS_BASE if ambiente == "stage" else PROD_MTLS_BASE

    if not cert_path.is_file():
        print(f"Certificado não encontrado: {cert_path}", file=sys.stderr)
        sys.exit(1)
    if not key_path.is_file():
        print(f"Chave privada não encontrada: {key_path}", file=sys.stderr)
        sys.exit(1)

    certificate = read_pem(cert_path)
    private_key = read_pem(key_path)

    cn = certificate_cn(certificate)
    if cn and cn != client_id:
        print(
            f"Aviso: CORA_CLIENT_ID ({client_id}) difere do CN do certificado ({cn}).",
            file=sys.stderr,
        )
        sys.exit(1)
    if cn:
        print(f"CN do certificado confere com Client ID: {cn}")

    rows = [
        ("CORA_CLIENT_ID", client_id),
        ("CORA_CERTIFICATE", certificate),
        ("CORA_PRIVATE_KEY", private_key),
        ("CORA_API_BASE", api_base),
    ]

    base = os.environ["SUPABASE_URL"].rstrip("/")
    try:
        upsert_config(base, rows)
    except urllib.error.HTTPError as e:
        print(f"Erro Supabase ({e.code}): {e.read().decode()[:500]}", file=sys.stderr)
        sys.exit(1)

    print(f"OK CORA_CLIENT_ID = {client_id}")
    print(f"OK CORA_CERTIFICATE = {len(certificate)} chars ({cert_path})")
    print(f"OK CORA_PRIVATE_KEY = {len(private_key)} chars ({key_path})")
    print(f"OK CORA_API_BASE = {api_base}")
    print("Config Cora aplicada. Rode: supabase functions deploy emit-boleto-cora --project-ref grlkbtnwvxorlfglyzid")


if __name__ == "__main__":
    main()
