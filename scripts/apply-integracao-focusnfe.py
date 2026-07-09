#!/usr/bin/env python3
"""Aplica config Focus NFe em integracao_config (não commitar tokens)."""
from __future__ import annotations

import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("pip install supabase", file=sys.stderr)
    raise

REQUIRED = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FOCUSNFE_TOKEN", "FOCUSNFE_CNPJ_PRESTADOR")

def main() -> None:
    missing = [k for k in REQUIRED if not os.environ.get(k)]
    if missing:
        print(f"Defina: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    token = os.environ["FOCUSNFE_TOKEN"]
    cnpj = "".join(c for c in os.environ["FOCUSNFE_CNPJ_PRESTADOR"] if c.isdigit())
    ambiente = os.environ.get("FOCUSNFE_AMBIENTE", "producao")

    client = create_client(url, key)
    rows = [
        ("FOCUSNFE_TOKEN", token),
        ("FOCUSNFE_AMBIENTE", ambiente),
        ("FOCUSNFE_CNPJ_PRESTADOR", cnpj),
        ("FOCUSNFE_CODIGO_TRIBUTACAO", os.environ.get("FOCUSNFE_CODIGO_TRIBUTACAO", "040802")),
        ("FOCUSNFE_CODIGO_NBS", os.environ.get("FOCUSNFE_CODIGO_NBS", "123019200")),
        ("FOCUSNFE_SIMPLES_NACIONAL", os.environ.get("FOCUSNFE_SIMPLES_NACIONAL", "1")),
    ]
    im = os.environ.get("FOCUSNFE_INSCRICAO_MUNICIPAL")
    if im:
        rows.append(("FOCUSNFE_INSCRICAO_MUNICIPAL", "".join(c for c in im if c.isdigit())))

    for chave, valor in rows:
        client.table("integracao_config").upsert(
            {"chave": chave, "valor": valor},
            on_conflict="chave",
        ).execute()
        mask = f"{valor[:8]}…" if "TOKEN" in chave else valor
        print(f"OK {chave} = {mask}")

    print("Config Focus NFe aplicada.")

if __name__ == "__main__":
    main()
