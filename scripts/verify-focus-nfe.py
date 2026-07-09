#!/usr/bin/env python3
"""Verifica config Focus NFe no Supabase e certificado na empresa."""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request

from load_app_env import load_app_env

FOCUS_API = "https://api.focusnfe.com.br"
FOCUS_HML = "https://homologacao.focusnfe.com.br"


def basic_auth(token: str) -> str:
    return "Basic " + base64.b64encode(f"{token}:".encode()).decode()


def focus_get(token: str, path: str, ambiente: str) -> dict:
    base = FOCUS_HML if ambiente == "homologacao" else FOCUS_API
    req = urllib.request.Request(
        f"{base}{path}",
        headers={"Authorization": basic_auth(token), "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode())


def supabase_get_config() -> dict[str, str]:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(
        f"{base}/rest/v1/integracao_config?chave=like.FOCUSNFE_%25&select=chave,valor",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        rows = json.loads(res.read().decode())
    return {r["chave"]: r["valor"] for r in rows}


def main() -> None:
    load_app_env()
    if not os.environ.get("FOCUSNFE_TOKEN") and not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        print("Defina FOCUSNFE_TOKEN e/ou SUPABASE_SERVICE_ROLE_KEY em .env.app", file=sys.stderr)
        sys.exit(1)

    print("=== Supabase integracao_config ===")
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        try:
            cfg = supabase_get_config()
            for k in sorted(cfg):
                v = cfg[k]
                print(f"  {k}: {v[:8] + '…' if 'TOKEN' in k else v}")
            token = cfg.get("FOCUSNFE_TOKEN") or os.environ.get("FOCUSNFE_TOKEN", "")
            ambiente = cfg.get("FOCUSNFE_AMBIENTE", "homologacao")
        except urllib.error.HTTPError as e:
            print(f"  ERRO: {e.code} {e.read().decode()[:300]}")
            token = os.environ.get("FOCUSNFE_TOKEN", "")
            ambiente = os.environ.get("FOCUSNFE_AMBIENTE", "homologacao")
    else:
        token = os.environ.get("FOCUSNFE_TOKEN", "")
        ambiente = os.environ.get("FOCUSNFE_AMBIENTE", "homologacao")

    if not token:
        print("Token Focus ausente.", file=sys.stderr)
        sys.exit(1)

    empresa_id = os.environ.get("FOCUSNFE_EMPRESA_ID", "230418")
    print(f"\n=== Focus empresa {empresa_id} ({ambiente}) ===")
    try:
        # GET empresa usa API de produção mesmo para consultar cadastro
        revenda = os.environ.get("FOCUSNFE_REVENDA_TOKEN") or token
        empresa = focus_get(revenda, f"/v2/empresas/{empresa_id}", "producao")
        print(f"  CNPJ: {empresa.get('cnpj')}")
        print(f"  Certificado: {empresa.get('certificado_valido_de')} → {empresa.get('certificado_valido_ate')}")
        print(f"  NFS-e Nacional homolog: {empresa.get('habilita_nfsen_homologacao')}")
        print(f"  NFS-e Nacional prod: {empresa.get('habilita_nfsen_producao')}")
        if not empresa.get("certificado_valido_ate"):
            print("  AVISO: certificado não detectado na API — confira no painel Focus.")
    except urllib.error.HTTPError as e:
        print(f"  ERRO empresa ({e.code}): {e.read().decode()[:400]}")

    print(f"\n=== Teste token emissão ({ambiente}) ===")
    try:
        # GET nfsen inexistente — 404 confirma auth OK; 401 = token errado
        ref = "cbmove-healthcheck"
        focus_get(token, f"/v2/nfsen/{ref}", ambiente)
        print("  Referência inesperadamente encontrada (ok)")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("  Token de emissão OK (404 em ref de teste — esperado)")
        elif e.code == 401:
            print("  ERRO: token inválido para emissão (401)")
            sys.exit(1)
        else:
            print(f"  Resposta {e.code}: {e.read().decode()[:300]}")

    print("\nPróximo passo: deploy emit-nf e testar na UI (modo Automático Focus NFe).")


if __name__ == "__main__":
    main()
