#!/usr/bin/env python3
"""Build deploy_edge_function args from workspace or /tmp/mcp-call-args."""
from __future__ import annotations

import json
import sys
from pathlib import Path

WORKSPACE = Path("/workspace/supabase/functions")
PREPARED = Path("/tmp/mcp-call-args")


def load_prepared(name: str) -> dict:
    path = PREPARED / f"{name}.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    raise FileNotFoundError(path)


def main() -> int:
    name = sys.argv[1] if len(sys.argv) > 1 else ""
    if not name:
        print("usage: mcp_deploy_from_prepared.py <function-name>", file=sys.stderr)
        return 1
    args = load_prepared(name)
    sys.stdout.write(json.dumps(args, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
