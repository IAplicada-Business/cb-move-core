#!/usr/bin/env python3
"""Emite NFS-e de teste direto na Focus (homologação) e aguarda status final."""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

from load_app_env import load_app_env

FOCUS_HML = "https://homologacao.focusnfe.com.br"


def auth_header(token: str) -> str:
    return "Basic " + base64.b64encode(f"{token}:".encode()).decode()


def focus(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        FOCUS_HML + path,
        data=data,
        headers={"Authorization": auth_header(token), "Content-Type": "application/json", "Accept": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw}
        raise RuntimeError(f"Focus {e.code}: {payload}") from e


def main() -> None:
    load_app_env()
    token = os.environ["FOCUSNFE_TOKEN"]
    cnpj = "".join(c for c in os.environ.get("FOCUSNFE_CNPJ_PRESTADOR", "42082795000174") if c.isdigit())
    ref = f"cbmove-spike-{uuid.uuid4().hex[:12]}"

    payload = {
        "data_emissao": time.strftime("%Y-%m-%dT%H:%M:%S-03:00"),
        "data_competencia": "2026-06-01",
        "codigo_municipio_emissora": 4314902,
        "cnpj_prestador": cnpj,
        "codigo_opcao_simples_nacional": 1,
        "regime_especial_tributacao": 0,
        "codigo_municipio_prestacao": "4314902",
        "codigo_tributacao_nacional_iss": os.environ.get("FOCUSNFE_CODIGO_TRIBUTACAO", "040802"),
        "codigo_nbs": os.environ.get("FOCUSNFE_CODIGO_NBS", "123019200"),
        "descricao_servico": "Servicos de fisioterapia neurofuncional | Paciente: Amanda Pavan | Competencia: 06/2026",
        "valor_servico": 150.0,
        "tributacao_iss": 1,
        "tipo_retencao_iss": 1,
        "situacao_tributaria_pis_cofins": "00",
        "cpf_tomador": "03555110020",
        "razao_social_tomador": "Amanda Pavan",
    }

    im = os.environ.get("FOCUSNFE_INSCRICAO_MUNICIPAL")
    if im:
        payload["inscricao_municipal_prestador"] = "".join(c for c in im if c.isdigit())

    print(f"POST /v2/nfsen ref={ref}")
    created = focus("POST", f"/v2/nfsen?ref={ref}", token, payload)
    print("create:", json.dumps(created, ensure_ascii=False))

    for i in range(40):
        time.sleep(3)
        data = focus("GET", f"/v2/nfsen/{ref}", token)
        status = data.get("status")
        print(
            f"poll {i + 1}: status={status} numero={data.get('numero')} "
            f"pdf={data.get('url_danfse') or data.get('url')}"
        )
        if status in ("autorizado", "autorizada"):
            print("SUCESSO:", json.dumps(data, ensure_ascii=False, indent=2))
            return
        if status in ("erro_autorizacao", "cancelado", "denegado"):
            print("FALHA:", json.dumps(data, ensure_ascii=False, indent=2))
            sys.exit(1)

    print("Timeout — ainda em processamento. Confira no painel Focus:", ref)
    sys.exit(2)


if __name__ == "__main__":
    main()
