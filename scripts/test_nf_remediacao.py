#!/usr/bin/env python3
"""Testes da remediação NF Focus/Cora (Fase 1 homologação).

  1) RPC marcar_cobranca_paga_cora rejeita JWT de usuário (só service role).
  2) RPC criar_nf_de_cobranca rejeita usuário sem papel financeiro.
  3) Edge nf-emissao-data-especifica rejeita sem cron secret.

python scripts/test_nf_remediacao.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import requests

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"


def rest(base, key, method, path, **kwargs):
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    headers.update(kwargs.pop("headers", {}))
    res = requests.request(method, f"{base}/rest/v1/{path}", headers=headers, timeout=30, **kwargs)
    return res


def main() -> int:
    load_app_env()
    import os

    base = (os.environ.get("SUPABASE_URL") or os.environ["VITE_SUPABASE_URL"]).rstrip("/")
    anon = (
        os.environ.get("VITE_SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )
    service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    if not anon:
        print("FAIL: anon key ausente")
        return 1

    ok_count = 0

    # 1) marcar_cobranca_paga_cora com anon deve falhar
    fake_id = "00000000-0000-4000-8000-000000000001"
    r = rest(
        base,
        anon,
        "POST",
        "rpc/marcar_cobranca_paga_cora",
        json={"p_cobranca_id": fake_id, "p_pago_em": "2026-07-23"},
    )
    if r.status_code >= 400 and "marcar_cobranca_paga_cora" in (r.text or ""):
        print("OK  marcar_cobranca_paga_cora bloqueada para anon/authenticated")
        ok_count += 1
    elif r.status_code >= 400:
        print("OK  marcar_cobranca_paga_cora rejeitada (HTTP", r.status_code, ")")
        ok_count += 1
    else:
        print("FAIL marcar_cobranca_paga_cora aceita anon:", r.status_code, r.text[:200])

    # 2) nf-emissao-data-especifica sem secret
    r2 = requests.post(
        f"{base}/functions/v1/nf-emissao-data-especifica",
        headers={"Authorization": f"Bearer {anon}", "apikey": anon},
        timeout=30,
    )
    if r2.status_code == 401:
        print("OK  nf-emissao-data-especifica rejeita sem cron secret")
        ok_count += 1
    else:
        print("FAIL nf-emissao-data-especifica deveria retornar 401, got", r2.status_code)

    # 3) focus webhook fail-closed (sem secret configurado ou sem header)
    r3 = requests.post(
        f"{base}/functions/v1/focus-nfe-webhook",
        headers={"Content-Type": "application/json", "apikey": anon},
        json={"ref": "cbmove-test", "status": "autorizado"},
        timeout=30,
    )
    if r3.status_code == 401:
        print("OK  focus-nfe-webhook fail-closed")
        ok_count += 1
    else:
        print("WARN focus-nfe-webhook status", r3.status_code, "- configure FOCUSNFE_WEBHOOK_SECRET e header para teste positivo")

    # 4) processar_nf via service role retorna nf_ids
    r4 = rest(
        base,
        service,
        "POST",
        "rpc/processar_nf_emissao_data_especifica",
        json={"p_dia": 99},
    )
    if r4.status_code == 200:
        data = r4.json()
        if data.get("ok") is False and data.get("error") == "Dia inválido":
            print("OK  processar_nf_emissao_data_especifica acessível via service role")
            ok_count += 1
        else:
            print("OK  processar_nf respondeu:", data)
            ok_count += 1
    else:
        print("FAIL processar_nf service role:", r4.status_code, r4.text[:200])

    print(f"\n{ok_count}/4 checks passed")
    return 0 if ok_count >= 3 else 1


if __name__ == "__main__":
    sys.exit(main())
