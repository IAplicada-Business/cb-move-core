#!/usr/bin/env python3
"""Busca cobrança elegível e testa emissão de boleto Cora (token mTLS + POST /v2/invoices)."""
from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

ROOT = Path(__file__).resolve().parent.parent
TOKEN_URL = "https://matls-clients.api.stage.cora.com.br/token"
INVOICES_URL = "https://matls-clients.api.stage.cora.com.br/v2/invoices"


def api_get(url: str, key: str) -> list | dict:
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read())


def cora_token(client_id: str, cert: Path, key_path: Path) -> str:
    ctx = ssl.create_default_context()
    ctx.load_cert_chain(certfile=str(cert), keyfile=str(key_path))
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
    with urllib.request.urlopen(req, context=ctx, timeout=30) as res:
        data = json.loads(res.read())
    return data["access_token"]


def emit_invoice(token: str, cert: Path, key_path: Path, payload: dict, idem: str) -> dict:
    ctx = ssl.create_default_context()
    ctx.load_cert_chain(certfile=str(cert), keyfile=str(key_path))
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        INVOICES_URL,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Idempotency-Key": idem,
        },
    )
    with urllib.request.urlopen(req, context=ctx, timeout=60) as res:
        return json.loads(res.read())


def find_cobranca(base: str, key: str, hoje: str) -> dict | None:
    """Cobrança com paciente cpf+email, vencimento >= hoje, valor >= 5, não paga."""
    url = (
        f"{base}/rest/v1/cobrancas"
        f"?select=id,paciente_id,valor,vencimento,status,competencia_mes,competencia_ano,servico,"
        f"pacientes(nome,cpf,email)"
        f"&vencimento=gte.{hoje}"
        f"&status=neq.pago&status=neq.cancelado"
        f"&valor=gte.5"
        f"&order=vencimento.asc"
        f"&limit=50"
    )
    rows = api_get(url, key)
    if not isinstance(rows, list):
        return None
    for row in rows:
        pac = row.get("pacientes") or {}
        cpf = "".join(ch for ch in (pac.get("cpf") or "") if ch.isdigit())
        email = (pac.get("email") or "").strip()
        if len(cpf) in (11, 14) and email:
            return row
    return None


def build_payload(cob: dict, hoje: str) -> dict:
    pac = cob["pacientes"]
    cpf = "".join(ch for ch in pac["cpf"] if ch.isdigit())
    doc_type = "CNPJ" if len(cpf) > 11 else "CPF"
    venc = cob["vencimento"][:10]
    if venc < hoje:
        venc = hoje
    valor_cents = max(500, round(float(cob["valor"]) * 100))
    nome = (pac.get("nome") or "Paciente")[:60]
    servico = (cob.get("servico") or "Fisioterapia CB MOVE")[:100]
    return {
        "code": cob["id"],
        "customer": {
            "name": nome,
            "email": pac["email"][:60],
            "document": {"identity": cpf, "type": doc_type},
        },
        "services": [
            {
                "name": servico,
                "description": servico,
                "amount": valor_cents,
            }
        ],
        "payment_terms": {"due_date": venc},
        "payment_forms": ["BANK_SLIP", "PIX"],
    }


def main() -> None:
    load_app_env()
    base = (os.environ.get("SUPABASE_URL") or os.environ["VITE_SUPABASE_URL"]).rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client_id = (os.environ.get("CORA_CLIENT_ID") or "").strip()
    cert_path = os.environ.get("CORA_CERTIFICATE_PATH", "").strip()
    priv_path = os.environ.get("CORA_PRIVATE_KEY_PATH", "").strip()

    if not all([client_id, cert_path, priv_path]):
        print("Defina CORA_CLIENT_ID, CORA_CERTIFICATE_PATH, CORA_PRIVATE_KEY_PATH", file=sys.stderr)
        sys.exit(1)

    cert = (ROOT / cert_path).resolve() if not Path(cert_path).is_absolute() else Path(cert_path)
    priv = (ROOT / priv_path).resolve() if not Path(priv_path).is_absolute() else Path(priv_path)

    hoje = date.today().isoformat()
    print(f"Buscando cobrança elegível (vencimento >= {hoje})…")

    cob = find_cobranca(base, key, hoje)
    if not cob:
        print("Nenhuma cobrança com CPF+e-mail+vencimento futuro. Tentando Amanda Pavan…", file=sys.stderr)
        url = (
            f"{base}/rest/v1/pacientes"
            f"?select=id,nome,cpf,email"
            f"&nome=ilike.*Amanda*Pavan*"
            f"&limit=1"
        )
        pacs = api_get(url, key)
        if pacs:
            pid = pacs[0]["id"]
            url2 = (
                f"{base}/rest/v1/cobrancas"
                f"?select=id,paciente_id,valor,vencimento,status,servico,pacientes(nome,cpf,email)"
                f"&paciente_id=eq.{pid}"
                f"&status=neq.pago&status=neq.cancelado"
                f"&order=competencia_ano.desc,competencia_mes.desc"
                f"&limit=1"
            )
            rows = api_get(url2, key)
            if rows:
                cob = rows[0]
                cob["vencimento"] = hoje
                print(f"Usando cobrança de Amanda com vencimento ajustado para {hoje}")

    if not cob:
        print("ERRO: nenhuma cobrança encontrada para teste.", file=sys.stderr)
        sys.exit(1)

    pac = cob.get("pacientes") or {}
    print(f"Paciente: {pac.get('nome')}")
    print(f"Cobrança: {cob['id']} | R$ {cob['valor']} | venc {cob['vencimento']} | {cob['status']}")

    print("Obtendo token Cora…")
    try:
        token = cora_token(client_id, cert, priv)
        print("Token OK")
    except urllib.error.HTTPError as e:
        print(f"Token FALHOU {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)

    payload = build_payload(cob, hoje)
    print("Payload (resumo):")
    print(json.dumps(
        {
            "customer": payload["customer"]["name"],
            "document": payload["customer"]["document"]["identity"][:3] + "***",
            "amount": payload["services"][0]["amount"],
            "due_date": payload["payment_terms"]["due_date"],
        },
        indent=2,
    ))

    print("Emitindo boleto…")
    try:
        result = emit_invoice(token, cert, priv, payload, cob["id"])
    except urllib.error.HTTPError as e:
        print(f"Invoice FALHOU {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)

    print("SUCESSO!")
    print(json.dumps(
        {
            "cora_invoice_id": result.get("id"),
            "status": result.get("status"),
            "total_amount": result.get("total_amount"),
            "boleto_url": (result.get("payment_options") or {}).get("bank_slip", {}).get("url"),
            "pix_emv": (result.get("pix") or {}).get("emv") if result.get("pix") else None,
        },
        indent=2,
        ensure_ascii=False,
    ))

    boleto_url = (result.get("payment_options") or {}).get("bank_slip", {}).get("url")
    if boleto_url:
        patch = json.dumps({
            "boleto_url": boleto_url,
            "cora_invoice_id": result.get("id"),
            "forma_pagamento": "boleto",
        }).encode()
        req = urllib.request.Request(
            f"{base}/rest/v1/cobrancas?id=eq.{cob['id']}",
            data=patch,
            method="PATCH",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            res.read()
        print(f"Cobrança atualizada com boleto_url no Supabase.")


if __name__ == "__main__":
    main()
