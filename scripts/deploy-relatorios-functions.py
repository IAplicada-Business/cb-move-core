#!/usr/bin/env python3
"""Deploy das edge functions do code review de relatórios."""
from __future__ import annotations

import os
import subprocess
import sys

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FUNCTIONS = [
    "gerar-relatorio-mensal",
    "sign-relatorio",
    "clicksign-webhook",
]


def main() -> None:
    load_app_env()
    if not os.environ.get("SUPABASE_ACCESS_TOKEN"):
        print("Defina SUPABASE_ACCESS_TOKEN (sbp_...) em .env.app", file=sys.stderr)
        sys.exit(1)

    for fn in FUNCTIONS:
        print(f"Deploy {fn}…")
        result = subprocess.run(
            f"npm exec -- supabase functions deploy {fn} --project-ref {PROJECT_REF}",
            cwd=ROOT,
            env=os.environ.copy(),
            shell=True,
        )
        if result.returncode != 0:
            sys.exit(result.returncode)

    print("Relatórios functions deployadas.")


if __name__ == "__main__":
    main()
