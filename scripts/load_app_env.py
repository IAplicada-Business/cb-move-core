"""Carrega variáveis locais de scripts/CLI sem misturar com o .env do Lovable."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _parse_env_line(line: str) -> tuple[str, str] | None:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    if line.startswith("export "):
        line = line[7:].strip()
    if "=" not in line:
        return None
    key, _, raw = line.partition("=")
    key = key.strip()
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return key, value


def _load_file(path: Path, *, override: bool) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        parsed = _parse_env_line(line)
        if not parsed:
            continue
        key, value = parsed
        if override:
            os.environ[key] = value
        else:
            os.environ.setdefault(key, value)


def load_app_env() -> Path:
    """
    Ordem:
    1. `.env` — integração Lovable (chaves públicas, URL do projeto)
    2. `.env.app` — tokens locais da equipe (gitignored)

    Variáveis já definidas no shell têm prioridade sobre `.env`;
    `.env.app` sobrescreve valores vindos de `.env`.
    """
    _load_file(ROOT / ".env", override=False)
    app_env = ROOT / ".env.app"
    _load_file(app_env, override=True)

    if not os.environ.get("SUPABASE_URL"):
        vite_url = os.environ.get("VITE_SUPABASE_URL")
        if vite_url:
            os.environ["SUPABASE_URL"] = vite_url

    return app_env


def require_app_env_file() -> Path:
    path = load_app_env()
    if not path.is_file():
        example = ROOT / ".env.app.example"
        raise FileNotFoundError(
            f"Arquivo {path} não encontrado. Copie {example.name} para .env.app e preencha os tokens."
        )
    return path
