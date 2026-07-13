#!/usr/bin/env python3
"""Reteste NFS-e homologação (Focus suporte: ambiente nacional estabilizado)."""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_app_env() -> None:
    for name in (".env", ".env.app"):
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, raw = line.partition("=")
            value = raw.strip().strip("\"'")
            os.environ.setdefault(key.strip(), value)
    if not os.environ.get("SUPABASE_URL") and os.environ.get("VITE_SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.environ["VITE_SUPABASE_URL"]


FOCUS_HML = "https://homologacao.focusnfe.com.br"


def auth_header(token: str) -> str:
    return "Basic " + base64.b64encode(f"{token}:".encode()).decode()


def focus_get(token: str, ref: str) -> dict:
    req = urllib.request.Request(
        f"{FOCUS_HML}/v2/nfsen/{ref}",
        headers={"Authorization": auth_header(token), "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read())


def focus_post(token: str, ref: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{FOCUS_HML}/v2/nfsen?ref={ref}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": auth_header(token),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read())


def amanda_payload() -> dict:
    now = time.localtime()
    competencia = f"{now.tm_year}-{now.tm_mon:02d}-01"
    return {
        "data_emissao": time.strftime("%Y-%m-%dT%H:%M:%S-03:00"),
        "data_competencia": competencia,
        "codigo_municipio_emissora": 4314902,
        "cnpj_prestador": "".join(c for c in os.environ.get("FOCUSNFE_CNPJ_PRESTADOR", "42082795000174") if c.isdigit()),
        # POA (CNC NFS-e): NÃO enviar IM — Focus retorna E0120 se informado.
        "codigo_opcao_simples_nacional": 3,  # 1=não optante, 2=MEI, 3=ME/EPP (CB MOVE)
        "regime_tributario_simples_nacional": 1,  # fed+mun pelo SN (E0166 se ausente)
        "percentual_total_tributos_simples_nacional": 6.0,  # pTotTribSN — validar com Diego
        "regime_especial_tributacao": 0,
        "codigo_municipio_prestacao": "4314902",
        "codigo_tributacao_nacional_iss": "040802",
        "codigo_nbs": "123019200",
        "descricao_servico": (
            "Servicos de fisioterapia neurofuncional | Paciente: Amanda Pavan | "
            f"Competencia: {now.tm_mon:02d}/{now.tm_year}"
        ),
        "valor_servico": 150.0,
        "tributacao_iss": 1,
        "tipo_retencao_iss": 1,
        "situacao_tributaria_pis_cofins": "00",
        "cpf_tomador": "03555110020",
        "razao_social_tomador": "Amanda Pavan",
        "email_tomador": "pavan.amandaa@gmail.com",
    }


def poll_until_done(token: str, ref: str, max_attempts: int = 30) -> dict:
    for i in range(max_attempts):
        time.sleep(4)
        data = focus_get(token, ref)
        status = data.get("status")
        print(
            f"poll {i + 1}: status={status} numero={data.get('numero')} "
            f"erros={data.get('erros')}"
        )
        st = str(status or "").lower()
        if st in ("autorizado", "autorizada"):
            return data
        if "erro" in st or "deneg" in st:
            return data
    return focus_get(token, ref)


def main() -> None:
    load_app_env()
    token = os.environ["FOCUSNFE_TOKEN"]
    mode = sys.argv[1] if len(sys.argv) > 1 else "new"

    if mode == "retry":
        ref = "cbmove-95bf3ac6-20ce-439e-bc1e-f94a8e13a117"
        print(f"Reenviando ref existente: {ref}")
    else:
        ref = f"cbmove-retest-{uuid.uuid4().hex[:10]}"
        print(f"Nova ref: {ref}")

    created = focus_post(token, ref, amanda_payload())
    print("POST:", json.dumps(created, ensure_ascii=False, indent=2))

    final = poll_until_done(token, ref)
    print("\nFINAL:", json.dumps(final, ensure_ascii=False, indent=2)[:4000])

    st = str(final.get("status", "")).lower()
    if st in ("autorizado", "autorizada"):
        print("\nOK: NFS-e autorizada na homologação.")
        return
    if "erro" in st:
        sys.exit(1)
    print("\nAinda em processamento — consulte novamente em alguns minutos.")


if __name__ == "__main__":
    main()
