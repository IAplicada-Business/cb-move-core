#!/usr/bin/env python3
"""Importa histórico Jun/2026 do Diego Pereira Agnes (relatório físico) no prontuário.

Dry-run por padrão. Use --apply para gravar no Supabase.
Opcional: --pdf-path caminho/scan.pdf anexa documento físico na aba Documentos.

Uso:
  python scripts/seed-diego-prontuario-jun2026.py
  python scripts/seed-diego-prontuario-jun2026.py --apply
  python scripts/seed-diego-prontuario-jun2026.py --apply --pdf-path relatorio-diego-jun2026.pdf
"""
from __future__ import annotations

import csv
import json
import mimetypes
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "scripts" / "out"
APPLY = "--apply" in sys.argv

DIEGO_PACIENTE_ID = "c48ef51c-c029-427c-bc43-617e526e96f2"
COMPETENCIA_MES = 6
COMPETENCIA_ANO = 2026

FISIO_NAMES: dict[str, str] = {
    "diego": "Diego Silveira de Paula Xavier",
    "mathias": "Mathias Mariani de Campos Velho Teixeira",
    "rinaldo": "Rinaldo Pietrowski Pinto",
    "lorenzo": "Lorenzo Caon Da Silva",
    "william": "William Vinícius Monteiro Pacheco",
}

SESSOES = [
    {
        "data": "2026-06-25",
        "fisios": ["diego", "mathias"],
        "objetivo": "Sessão dupla — Diego Mathias (relatório físico Jun/2026).",
    },
    {
        "data": "2026-06-26",
        "fisios": ["rinaldo", "lorenzo"],
        "objetivo": "Sessão dupla — Rinaldo Lorenzo (relatório físico Jun/2026).",
    },
    {
        "data": "2026-06-30",
        "fisios": ["lorenzo", "william"],
        "objetivo": "Sessão dupla — Lorenzo William (relatório físico Jun/2026).",
    },
]


def pdf_path_arg() -> Path | None:
    for i, arg in enumerate(sys.argv):
        if arg == "--pdf-path" and i + 1 < len(sys.argv):
            return Path(sys.argv[i + 1]).expanduser().resolve()
    return None


def load_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    for name in (".env.app", ".env"):
        fp = ROOT / name
        if not fp.is_file():
            continue
        for line in fp.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[7:]
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = (env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("Credenciais Supabase ausentes (.env.app)")
    return url, key


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.lower().split())


def api(
    url: str,
    key: str,
    method: str,
    path: str,
    body: dict | list | None = None,
    *,
    prefer: str = "return=representation",
) -> list | dict | None:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{url}/rest/v1/{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:400]
        raise SystemExit(f"HTTP {e.code} {method} {path}: {detail}") from e


def get_json(url: str, key: str, path: str) -> list:
    rows: list = []
    offset = 0
    while True:
        chunk = api(url, key, "GET", f"{path}&limit=500&offset={offset}")
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < 500:
            break
        offset += 500
    return rows


def resolve_fisios(url: str, key: str) -> dict[str, str]:
    fisios = get_json(url, key, "fisioterapeutas?select=id,nome&ativo=eq.true")
    by_norm = {norm(f["nome"]): f["id"] for f in fisios}
    out: dict[str, str] = {}
    for alias, full in FISIO_NAMES.items():
        fid = by_norm.get(norm(full))
        if not fid:
            raise SystemExit(f"Fisioterapeuta não encontrado: {full}")
        out[alias] = fid
    return out


def find_sessao(url: str, key: str, paciente_id: str, data: str) -> dict | None:
    rows = get_json(
        url,
        key,
        f"sessoes?select=id,data,sigla,fisioterapeuta_id&paciente_id=eq.{paciente_id}&data=eq.{data}",
    )
    return rows[0] if rows else None


def upsert_sessao(
    url: str,
    key: str,
    paciente_id: str,
    data: str,
    principal_fisio_id: str,
) -> str:
    existing = find_sessao(url, key, paciente_id, data)
    if existing:
        return existing["id"]

    if not APPLY:
        return f"dry-{data}"

    row = api(
        url,
        key,
        "POST",
        "sessoes",
        {
            "paciente_id": paciente_id,
            "data": data,
            "sigla": "P",
            "fisioterapeuta_id": principal_fisio_id,
            "observacoes": "Importado do relatório físico Jun/2026",
        },
    )
    return row[0]["id"]


def upsert_sessao_fisios(
    url: str,
    key: str,
    sessao_id: str,
    fisio_ids: list[str],
) -> None:
    if not APPLY or sessao_id.startswith("dry-"):
        return
    existing = get_json(
        url,
        key,
        f"sessao_fisioterapeutas?select=fisioterapeuta_id&sessao_id=eq.{sessao_id}",
    )
    existing_ids = {r["fisioterapeuta_id"] for r in existing}
    for idx, fid in enumerate(fisio_ids):
        if fid in existing_ids:
            continue
        api(
            url,
            key,
            "POST",
            "sessao_fisioterapeutas",
            {
                "sessao_id": sessao_id,
                "fisioterapeuta_id": fid,
                "principal": idx == 0,
            },
            prefer="return=minimal",
        )


def upsert_evolucao(
    url: str,
    key: str,
    paciente_id: str,
    data: str,
    sessao_id: str,
    fisio_id: str,
    objetivo: str,
) -> str:
    rows = get_json(
        url,
        key,
        f"prontuario_evolucoes?select=id&paciente_id=eq.{paciente_id}&data=eq.{data}&limit=1",
    )
    if rows:
        return rows[0]["id"]

    if not APPLY:
        return f"dry-evo-{data}"

    payload = {
        "paciente_id": paciente_id,
        "sessao_id": None if sessao_id.startswith("dry-") else sessao_id,
        "fisioterapeuta_id": fisio_id,
        "data": data,
        "subjetivo": "Sessão realizada",
        "objetivo": objetivo,
        "plano": "Continuidade do plano de tratamento neurofuncional conforme periodização.",
        "fonte": "manual",
    }
    row = api(url, key, "POST", "prontuario_evolucoes", payload)
    return row[0]["id"]


def patch_paciente(url: str, key: str) -> None:
    if not APPLY:
        return
    api(
        url,
        key,
        "PATCH",
        f"pacientes?id=eq.{DIEGO_PACIENTE_ID}",
        {
            "valor_sessao": 266,
            "frequencia_atendimento": "2 vezes por semana",
            "plano_total_sessoes": 26,
        },
        prefer="return=minimal",
    )


def upload_pdf_storage(url: str, key: str, pdf_path: Path) -> str:
    storage_path = f"relatorio-{DIEGO_PACIENTE_ID}-{COMPETENCIA_ANO}-06-documento-fisico.pdf"
    content = pdf_path.read_bytes()
    if not content.startswith(b"%PDF"):
        raise SystemExit(f"Arquivo não parece PDF: {pdf_path}")

    upload_url = f"{url}/storage/v1/object/relatorios-atendimento/{storage_path}"
    req = urllib.request.Request(
        upload_url,
        data=content,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
    )
    try:
        urllib.request.urlopen(req, timeout=120).read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:400]
        raise SystemExit(f"Upload storage falhou: {e.code} {detail}") from e

    return f"{url}/storage/v1/object/public/relatorios-atendimento/{storage_path}"


def upsert_relatorio_fisico(url: str, key: str, pdf_url: str | None) -> str:
    rows = get_json(
        url,
        key,
        f"relatorios_atendimento?select=id,pdf_url&paciente_id=eq.{DIEGO_PACIENTE_ID}"
        f"&competencia_mes=eq.{COMPETENCIA_MES}&competencia_ano=eq.{COMPETENCIA_ANO}"
        f"&modelo_pdf=eq.documento_fisico",
    )
    if rows:
        if APPLY and pdf_url and not rows[0].get("pdf_url"):
            api(
                url,
                key,
                "PATCH",
                f"relatorios_atendimento?id=eq.{rows[0]['id']}",
                {"pdf_url": pdf_url},
                prefer="return=minimal",
            )
        return rows[0]["id"]

    if not APPLY:
        return "dry-relatorio"

    modelo = "sharepoint"
    row = api(
        url,
        key,
        "POST",
        "relatorios_atendimento",
        {
            "paciente_id": DIEGO_PACIENTE_ID,
            "modelo": modelo,
            "competencia_mes": COMPETENCIA_MES,
            "competencia_ano": COMPETENCIA_ANO,
            "pdf_url": pdf_url,
            "assinado": True,
            "modelo_pdf": "documento_fisico",
            "num_sessoes": 3,
            "valor_sessao": 266,
            "valor_total": 798,
            "frequencia_texto": "2 vezes por semana",
            "carga_horaria": "1h25",
        },
    )
    return row[0]["id"]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    url, key = load_env()
    pdf_path = pdf_path_arg()
    fisio_ids = resolve_fisios(url, key)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    csv_path = OUT_DIR / f"seed-diego-jun2026-{ts}.csv"

    rows_out: list[dict] = []
    patch_paciente(url, key)

    for item in SESSOES:
        data = item["data"]
        fkeys = item["fisios"]
        fids = [fisio_ids[k] for k in fkeys]
        sessao_id = upsert_sessao(url, key, DIEGO_PACIENTE_ID, data, fids[0])
        upsert_sessao_fisios(url, key, sessao_id, fids)
        evo_id = upsert_evolucao(
            url, key, DIEGO_PACIENTE_ID, data, sessao_id, fids[0], item["objetivo"]
        )
        rows_out.append(
            {
                "data": data,
                "sessao_id": sessao_id,
                "evolucao_id": evo_id,
                "fisios": ", ".join(fkeys),
                "acao": "apply" if APPLY else "dry_run",
            }
        )

    pdf_url: str | None = None
    relatorio_acao = "skip_sem_pdf"
    relatorio_id = upsert_relatorio_fisico(url, key, None)
    relatorio_acao = "apply" if APPLY else "dry_run"
    rows_out.append(
        {
            "data": "documento_fisico",
            "sessao_id": relatorio_id,
            "evolucao_id": str(pdf_path) if pdf_path else "(sem arquivo — importar na aba Documentos do prontuário)",
            "fisios": "",
            "acao": relatorio_acao,
        }
    )
    if pdf_path:
        if not pdf_path.is_file():
            raise SystemExit(f"PDF não encontrado: {pdf_path}")
        if APPLY:
            pdf_url = upload_pdf_storage(url, key, pdf_path)
            api(
                url,
                key,
                "PATCH",
                f"relatorios_atendimento?id=eq.{relatorio_id}",
                {"pdf_url": pdf_url},
                prefer="return=minimal",
            )
        rows_out[-1]["evolucao_id"] = str(pdf_path)
        rows_out[-1]["acao"] = "apply" if APPLY else "dry_run"

    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["data", "sessao_id", "evolucao_id", "fisios", "acao"])
        w.writeheader()
        w.writerows(rows_out)

    print(f"Modo: {'APPLY' if APPLY else 'DRY-RUN'}")
    print(f"Paciente: Diego ({DIEGO_PACIENTE_ID})")
    print(f"CSV: {csv_path}")
    print(f"Sessões planejadas: {len(SESSOES)}")
    print(f"Documento físico: {relatorio_acao}")
    if not APPLY:
        print("Execute com --apply após revisar o CSV.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
