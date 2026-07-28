#!/usr/bin/env python3
"""Ajusta NFs do Alexandre após correção de cobranças (idempotente)."""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env
from audit_retroativos import Supa

VALOR = 10280.0
FIXES = [
    ("341c7238-759b-4eac-b7a7-ed019516d39a", {"valor": VALOR}),
    ("ccf6c395-aced-494c-8ec4-2383abc2ba55", {"status": "cancelada"}),
]


def patch(sb: Supa, table: str, filt: str, data: dict) -> list:
    path = f"{table}?{filt}"
    req = urllib.request.Request(
        f"{sb.url}/rest/v1/{urllib.parse.quote(path, safe='/?&=(),.*:_-')}",
        data=json.dumps(data).encode(),
        headers={
            "apikey": sb.key,
            "Authorization": f"Bearer {sb.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode())


def main() -> int:
    load_app_env()
    sb = Supa()
    for nf_id, data in FIXES:
        rows = patch(sb, "notas_fiscais", f"id=eq.{nf_id}", data)
        r = rows[0]
        print(f"{nf_id[:8]} status={r.get('status')} valor={r.get('valor')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
