#!/usr/bin/env python3
"""Consulta status de uma NFS-e na Focus (homologação)."""
from __future__ import annotations

import base64
import json
import sys
import time
import urllib.request

from load_app_env import load_app_env


def main() -> None:
    load_app_env()
    ref = sys.argv[1] if len(sys.argv) > 1 else "cbmove-99027dda-d302-48e7-996a-112a5499a035"
    token = __import__("os").environ["FOCUSNFE_TOKEN"]
    auth = "Basic " + base64.b64encode(f"{token}:".encode()).decode()
    url = f"https://homologacao.focusnfe.com.br/v2/nfsen/{ref}"

    for i in range(10):
        req = urllib.request.Request(url, headers={"Authorization": auth, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
        status = data.get("status")
        numero = data.get("numero") or data.get("numero_nfsen")
        pdf = data.get("url_danfse") or data.get("url_pdf")
        print(f"poll {i + 1}: status={status} numero={numero} pdf={pdf}")
        st = str(status or "").lower()
        if st in ("autorizado", "autorizada"):
            print("FINAL OK:", json.dumps(data, ensure_ascii=False, indent=2)[:3000])
            return
        if "erro" in st or "deneg" in st or "cancel" in st:
            print("FINAL ERRO:", json.dumps(data, ensure_ascii=False, indent=2)[:3000])
            sys.exit(1)
        time.sleep(3)

    print("Timeout aguardando autorizacao final.")


if __name__ == "__main__":
    main()
