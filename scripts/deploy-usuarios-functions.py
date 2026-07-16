#!/usr/bin/env python3
"""Publica edge functions de usuários e define SITE_URL via Management API."""
from __future__ import annotations

import io
import json
import mimetypes
import os
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

PROJECT = "grlkbtnwvxorlfglyzid"
ROOT = Path(__file__).resolve().parent.parent
FUNCTIONS_DIR = ROOT / "supabase" / "functions"
SITE_URL = "https://cb-move-harmony.lovable.app"
FUNCTIONS = ["list-users", "create-user", "send-user-invite"]


def set_secrets() -> None:
    token = os.environ["SUPABASE_ACCESS_TOKEN"]
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/secrets"
    body = json.dumps([
        {"name": "SITE_URL", "value": SITE_URL},
        {"name": "DEFAULT_INITIAL_PASSWORD", "value": "CB2026"},
    ]).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            print("secrets OK", res.read().decode()[:300])
    except urllib.error.HTTPError as e:
        print("secrets ERR", e.code, e.read().decode()[:500])


def bundle_function(slug: str) -> bytes:
    fn_dir = FUNCTIONS_DIR / slug
    shared_dir = FUNCTIONS_DIR / "_shared"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in fn_dir.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(fn_dir).as_posix())
        for path in shared_dir.rglob("*"):
            if path.is_file():
                zf.write(path, ("_shared/" + path.relative_to(shared_dir).as_posix()).replace("\\", "/"))
    return buf.getvalue()


def deploy_function(slug: str) -> None:
    token = os.environ["SUPABASE_ACCESS_TOKEN"]
    bundle = bundle_function(slug)
    metadata = json.dumps({
        "entrypoint_path": "index.ts",
        "name": slug,
        "verify_jwt": True,
    })

    boundary = "----cbmoveBoundary7d4f"
    parts: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
        )

    add_field("metadata", metadata)
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{slug}.zip\"\r\n"
        f"Content-Type: application/zip\r\n\r\n".encode()
    )
    parts.append(bundle)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)

    url = f"https://api.supabase.com/v1/projects/{PROJECT}/functions/deploy?slug={slug}"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            print(f"deploy {slug} OK", res.read().decode()[:400])
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"deploy {slug} ERR {e.code}", err[:800])
        raise RuntimeError(f"deploy {slug} failed") from e


def deploy_via_cli() -> None:
    for slug in FUNCTIONS:
        print(f"CLI deploy {slug}…")
        result = subprocess.run(
            ["npm", "exec", "--", "supabase", "functions", "deploy", slug, "--project-ref", PROJECT],
            cwd=ROOT,
            env=os.environ.copy(),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(result.stdout)
            print(result.stderr, file=sys.stderr)
            raise RuntimeError(f"CLI deploy {slug} failed")
        print(result.stdout.strip() or f"{slug} ok")


def main() -> int:
    load_app_env()
    if not os.environ.get("SUPABASE_ACCESS_TOKEN"):
        print("SUPABASE_ACCESS_TOKEN ausente em .env.app", file=sys.stderr)
        return 1

    print("=== Definindo secrets ===")
    set_secrets()

    print("\n=== Publicando edge functions ===")
    try:
        for slug in FUNCTIONS:
            deploy_function(slug)
    except RuntimeError:
        print("Management API falhou; tentando Supabase CLI…")
        deploy_via_cli()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
