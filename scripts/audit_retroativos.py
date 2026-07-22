#!/usr/bin/env python3
"""
Auditoria de cobranças retroativas: duplicatas, suspeitas R5 e valor vs paciente.

  python scripts/audit_retroativos.py
  python scripts/audit_retroativos.py --json-out scripts/audit_retroativos_report.json
  python scripts/audit_retroativos.py --ano 2026
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env
from lib.retroativos_valor import is_r5_suspect


class Supa:
    def __init__(self):
        url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").strip().strip("\"'")
        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
            or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
            or ""
        ).strip().strip("\"'")
        if not url.startswith("http"):
            raise SystemExit(f"SUPABASE_URL inválida: {url!r}")
        if not key:
            raise SystemExit("Chave Supabase ausente")
        self.url = url.rstrip("/")
        self.key = key

    def _req(self, method: str, path: str, extra_headers: dict | None = None):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)
        safe_path = urllib.parse.quote(path, safe="/?&=(),.*:_-")
        req = urllib.request.Request(f"{self.url}/rest/v1/{safe_path}", headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read().decode()
                return json.loads(raw) if raw else []
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:800]
            raise RuntimeError(f"HTTP {e.code} {path}: {detail}") from e

    def fetch_all(self, table: str, select: str, filt: str = "") -> list[dict]:
        rows: list[dict] = []
        offset = 0
        base = f"{table}?select={select}"
        if filt:
            base += f"&{filt}"
        while True:
            chunk = self._req("GET", f"{base}&order=id&offset={offset}&limit=1000")
            if not chunk:
                break
            rows.extend(chunk)
            if len(chunk) < 1000:
                break
            offset += 1000
        return rows


def audit(ano: int | None) -> dict:
    sb = Supa()
    pacientes = sb.fetch_all("pacientes", "id,nome,valor_mensal")
    pac_by_id = {p["id"]: p for p in pacientes}

    filt = "or=(status.eq.regularizar_retroativa,observacoes.ilike.*Retroativa*,servico.ilike.*retroativa*)"
    if ano:
        filt += f"&competencia_ano=eq.{ano}"
    cobrancas = sb.fetch_all(
        "cobrancas",
        "id,paciente_id,competencia_mes,competencia_ano,valor,status,servico,observacoes",
        filt,
    )

    dup_groups: dict[str, list[dict]] = defaultdict(list)
    r5_suspects: list[dict] = []
    valor_mensal_null: list[dict] = []

    for c in cobrancas:
        pid = c.get("paciente_id")
        pac = pac_by_id.get(pid or "")
        vm = pac.get("valor_mensal") if pac else None
        vm_f = float(vm) if vm is not None else None
        val = float(c.get("valor") or 0)

        key = f"{pid}|{c.get('competencia_mes')}|{c.get('competencia_ano')}|{val}|{(c.get('servico') or '')[:40]}"
        dup_groups[key].append(c)

        if is_r5_suspect(val, vm_f):
            r5_suspects.append(
                {
                    "id": c["id"],
                    "paciente": pac.get("nome") if pac else pid,
                    "competencia": f"{c.get('competencia_mes')}/{c.get('competencia_ano')}",
                    "valor": val,
                    "valor_mensal": vm_f,
                }
            )

        obs = (c.get("observacoes") or "").lower()
        if "retroativa" in obs and (vm_f is None or vm_f <= 0):
            valor_mensal_null.append(
                {
                    "id": c["id"],
                    "paciente": pac.get("nome") if pac else pid,
                    "competencia": f"{c.get('competencia_mes')}/{c.get('competencia_ano')}",
                    "valor": val,
                }
            )

    duplicates = [
        {
            "key": k,
            "count": len(v),
            "ids": [x["id"] for x in v],
            "paciente_id": v[0].get("paciente_id"),
            "competencia": f"{v[0].get('competencia_mes')}/{v[0].get('competencia_ano')}",
            "valor": float(v[0].get("valor") or 0),
        }
        for k, v in dup_groups.items()
        if len(v) > 1
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ano_filtro": ano,
        "total_retroativas": len(cobrancas),
        "duplicatas": duplicates,
        "r5_suspects": r5_suspects,
        "valor_mensal_ausente": valor_mensal_null,
        "summary": {
            "duplicatas_grupos": len(duplicates),
            "r5_suspects": len(r5_suspects),
            "valor_mensal_ausente": len(valor_mensal_null),
        },
    }


def main() -> int:
    load_app_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--ano", type=int, default=2026)
    ap.add_argument("--json-out", default="")
    args = ap.parse_args()

    report = audit(args.ano)
    s = report["summary"]
    print(f"Retroativas auditadas: {report['total_retroativas']}")
    print(f"  Grupos duplicados: {s['duplicatas_grupos']}")
    print(f"  Suspeitas R5:      {s['r5_suspects']}")
    print(f"  Sem valor_mensal:  {s['valor_mensal_ausente']}")

    if report["r5_suspects"][:5]:
        print("\nExemplos R5:")
        for row in report["r5_suspects"][:5]:
            print(f"  {row['paciente']} {row['competencia']} R$ {row['valor']} (mensal R$ {row['valor_mensal']})")

    if args.json_out:
        out = Path(args.json_out)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nRelatório: {out}")

    if s["duplicatas_grupos"] or s["r5_suspects"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
