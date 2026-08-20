#!/usr/bin/env python3
"""Load deploy args from /tmp/mcp-call-args/{name}.json for MCP deploy_edge_function."""
from __future__ import annotations

import json
import sys
from pathlib import Path

NAMES = [
    "cora-webhook",
    "cora-verificar-pagamentos",
    "emit-boleto-cora",
    "create-user",
    "emit-nf",
    "focus-nfe-webhook",
]


def load(name: str) -> dict:
    for base in (Path("/tmp/mcp-call-args"), Path("/tmp/mcp-deploy-now")):
        path = base / f"{name}.json"
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    raise FileNotFoundError(name)


def main() -> int:
    name = sys.argv[1] if len(sys.argv) > 1 else ""
    if not name:
        for fn in NAMES:
            try:
                args = load(fn)
                print(
                    f"{fn}: files={len(args['files'])} "
                    f"verify_jwt={args['verify_jwt']} "
                    f"bytes={len(json.dumps(args, separators=(',', ':')))}"
                )
            except FileNotFoundError:
                print(f"{fn}: MISSING")
        return 0
    args = load(name)
    sys.stdout.write(json.dumps(args, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
