#!/usr/bin/env python3
"""Deploy da edge function emit-nf usando credenciais de .env.app."""
from __future__ import annotations

import os
import subprocess
import sys

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> None:
    load_app_env()
    if not os.environ.get("SUPABASE_ACCESS_TOKEN"):
        print("Defina SUPABASE_ACCESS_TOKEN (sbp_...) em .env.app", file=sys.stderr)
        sys.exit(1)

    result = subprocess.run(
        "npm exec -- supabase functions deploy emit-nf --project-ref " + PROJECT_REF,
        cwd=ROOT,
        env=os.environ.copy(),
        shell=True,
    )
    if result.returncode != 0:
        sys.exit(result.returncode)
    print("emit-nf deployado.")


if __name__ == "__main__":
    main()
