#!/usr/bin/env python3
"""Consulta status Focus de uma ref NFS-e."""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.request

from load_app_env import load_app_env

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


def main() -> None:
    load_app_env()
    token = os.environ["FOCUSNFE_TOKEN"]
    ref = sys.argv[1] if len(sys.argv) > 1 else "cbmove-1adc1167-148b-449c-b0e3-75e8ada576fc"
    attempts = int(sys.argv[2]) if len(sys.argv) > 2 else 20

    final = {}
    for i in range(attempts):
        final = focus_get(token, ref)
        status = final.get("status")
        erros = final.get("erros")
        print(
            f"poll {i + 1}: status={status} numero={final.get('numero')} erros={erros}"
        )
        st = str(status or "").lower()
        if st in ("autorizado", "autorizada"):
            print("\nAUTORIZADA")
            print(json.dumps(final, ensure_ascii=False, indent=2)[:4000])
            return
        if "erro" in st or "deneg" in st:
            print("\nERRO")
            print(json.dumps(final, ensure_ascii=False, indent=2)[:4000])
            sys.exit(1)
        time.sleep(5)

    print("\nAinda processando após polls")
    print(json.dumps(final, ensure_ascii=False, indent=2)[:4000])


if __name__ == "__main__":
    main()
