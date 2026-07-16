#!/usr/bin/env python3
"""Deploy de uma ou mais Edge Functions via Supabase CLI, sem expor o token no console."""
from __future__ import annotations

import os
import subprocess
import sys

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: python scripts/deploy_supabase_function.py <funcao> [--no-verify-jwt] [<funcao2> ...]", file=sys.stderr)
        return 1

    load_app_env()
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        print("SUPABASE_ACCESS_TOKEN ausente em .env.app", file=sys.stderr)
        return 1

    args = sys.argv[1:]
    no_verify_jwt = "--no-verify-jwt" in args
    functions = [a for a in args if not a.startswith("--")]

    env = os.environ.copy()
    env["SUPABASE_ACCESS_TOKEN"] = token

    for fn in functions:
        cmd = ["npx", "supabase", "functions", "deploy", fn, "--project-ref", PROJECT_REF]
        if no_verify_jwt:
            cmd.append("--no-verify-jwt")
        print(f"$ {' '.join(cmd)}")
        result = subprocess.run(cmd, env=env, shell=(os.name == "nt"))
        if result.returncode != 0:
            print(f"Falhou: {fn} (exit {result.returncode})", file=sys.stderr)
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
