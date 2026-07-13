#!/usr/bin/env python3
"""
Backfill da tabela `sessoes` a partir de agendamentos com status realizado/faltou.

  python scripts/backfill_sessoes_agenda.py --dry-run
  python scripts/backfill_sessoes_agenda.py --apply
  python scripts/backfill_sessoes_agenda.py --apply --desde 2025-01-01

Regras (espelham updateAgendamentoStatus):
- realizado → sigla P
- faltou → sigla F
- Mesmo paciente + data: P vence F
- Preenche hora a partir de agendamentos.inicio quando ausente
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env


SIGLA_RANK = {"P": 3, "RC": 3, "F": 2, "FJ": 2, "NJ": 1, "NR": 1}


def hora_from_inicio(inicio: str) -> str | None:
    match = re.search(r"T(\d{2}:\d{2})", inicio or "")
    return f"{match.group(1)}:00" if match else None


@dataclass
class Alvo:
    paciente_id: str
    data: str
    sigla: str
    fisioterapeuta_id: str | None
    hora: str | None


class Supa:
    def __init__(self):
        url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").strip().strip("\"'")
        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
            or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
            or ""
        ).strip().strip("\"'")
        if not url.startswith("http"):
            raise SystemExit(f"SUPABASE_URL inválida: {url!r}")
        if not key:
            raise SystemExit("Chave Supabase ausente (.env.app)")
        self.url = url.rstrip("/")
        self.key = key
        print(f"Supabase: {self.url}")

    def _req(self, method: str, path: str, body=None, prefer: str | None = None):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = None if body is None else json.dumps(body).encode()
        safe_path = urllib.parse.quote(path, safe="/?&=(),.*:_-")
        req = urllib.request.Request(f"{self.url}/rest/v1/{safe_path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:800]
            raise RuntimeError(f"HTTP {e.code} {path}: {detail}") from e

    def fetch_agendamentos(self, desde: str | None) -> list[dict]:
        rows: list[dict] = []
        offset = 0
        filt = (
            "select=id,paciente_id,fisioterapeuta_id,inicio,status"
            "&paciente_id=not.is.null"
            "&status=in.(realizado,faltou)"
            "&order=inicio"
        )
        if desde:
            filt += f"&inicio=gte.{desde}T00:00:00"
        while True:
            chunk = self._req("GET", f"agendamentos?{filt}&offset={offset}&limit=1000") or []
            rows.extend(chunk)
            if len(chunk) < 1000:
                break
            offset += 1000
        return rows

    def fetch_sessoes(self, desde: str | None) -> list[dict]:
        rows: list[dict] = []
        offset = 0
        filt = "select=id,paciente_id,data,sigla,hora,fisioterapeuta_id&order=data"
        if desde:
            filt += f"&data=gte.{desde}"
        while True:
            chunk = self._req("GET", f"sessoes?{filt}&offset={offset}&limit=1000") or []
            rows.extend(chunk)
            if len(chunk) < 1000:
                break
            offset += 1000
        return rows

    def upsert_sessao(self, alvo: Alvo) -> None:
        existing = self._req(
            "GET",
            f"sessoes?select=id,sigla,hora"
            f"&paciente_id=eq.{alvo.paciente_id}"
            f"&data=eq.{alvo.data}"
            f"&order=created_at.asc"
            f"&limit=1",
        )
        patch = {
            "sigla": alvo.sigla,
            "fisioterapeuta_id": alvo.fisioterapeuta_id,
        }
        if alvo.hora:
            patch["hora"] = alvo.hora

        if existing:
            row = existing[0]
            # Não rebaixar sigla se já houver P/RC e o alvo for F
            atual = row.get("sigla") or ""
            if (SIGLA_RANK.get(atual, 0) > SIGLA_RANK.get(alvo.sigla, 0)):
                if alvo.hora and not row.get("hora"):
                    self._req(
                        "PATCH",
                        f"sessoes?id=eq.{row['id']}",
                        {"hora": alvo.hora},
                        prefer="return=minimal",
                    )
                return
            if row.get("hora") and not alvo.hora:
                patch.pop("hora", None)
            self._req("PATCH", f"sessoes?id=eq.{row['id']}", patch, prefer="return=minimal")
            return

        self._req(
            "POST",
            "sessoes",
            {
                "paciente_id": alvo.paciente_id,
                "data": alvo.data,
                "sigla": alvo.sigla,
                "fisioterapeuta_id": alvo.fisioterapeuta_id,
                "hora": alvo.hora,
            },
            prefer="return=minimal",
        )


def consolidar_agendamentos(rows: list[dict]) -> dict[tuple[str, str], Alvo]:
    mapa: dict[tuple[str, str], Alvo] = {}
    for ag in rows:
        paciente_id = ag.get("paciente_id")
        inicio = ag.get("inicio") or ""
        if not paciente_id or not inicio:
            continue
        data = inicio[:10]
        sigla = "P" if ag.get("status") == "realizado" else "F"
        key = (paciente_id, data)
        atual = mapa.get(key)
        hora = hora_from_inicio(inicio)
        fisio = ag.get("fisioterapeuta_id")
        if not atual or SIGLA_RANK.get(sigla, 0) > SIGLA_RANK.get(atual.sigla, 0):
            mapa[key] = Alvo(paciente_id, data, sigla, fisio, hora)
        elif atual and not atual.hora and hora:
            atual.hora = hora
    return mapa


def analisar(
    alvos: dict[tuple[str, str], Alvo],
    sessoes: list[dict],
) -> tuple[int, int, int]:
    por_chave = {(s["paciente_id"], s["data"]): s for s in sessoes}
    inserir = atualizar = hora_only = 0
    for key, alvo in alvos.items():
        existente = por_chave.get(key)
        if not existente:
            inserir += 1
            continue
        sigla_ok = SIGLA_RANK.get(existente.get("sigla") or "", 0) >= SIGLA_RANK.get(alvo.sigla, 0)
        hora_ok = bool(existente.get("hora")) or not alvo.hora
        if sigla_ok and hora_ok:
            continue
        if sigla_ok and not hora_ok:
            hora_only += 1
        else:
            atualizar += 1
    return inserir, atualizar, hora_only


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill sessoes ← agendamentos")
    parser.add_argument("--dry-run", action="store_true", help="Apenas relatório (padrão)")
    parser.add_argument("--apply", action="store_true", help="Aplica inserts/updates")
    parser.add_argument("--desde", default=None, help="Data mínima YYYY-MM-DD")
    args = parser.parse_args()
    apply = args.apply and not args.dry_run

    load_app_env()
    db = Supa()

    ags = db.fetch_agendamentos(args.desde)
    alvos = consolidar_agendamentos(ags)
    sessoes = db.fetch_sessoes(args.desde)
    inserir, atualizar, hora_only = analisar(alvos, sessoes)

    print(f"Agendamentos (realizado/faltou): {len(ags)}")
    print(f"Células consolidadas (paciente+dia): {len(alvos)}")
    print(f"Sessões existentes no período: {len(sessoes)}")
    print(f"A inserir: {inserir} | A atualizar sigla: {atualizar} | Só hora: {hora_only}")

    if not apply:
        print("\nDry-run. Use --apply para gravar.")
        return

    ok = 0
    for alvo in alvos.values():
        db.upsert_sessao(alvo)
        ok += 1
        if ok % 100 == 0:
            print(f"  … {ok}/{len(alvos)}")
    print(f"Concluído: {ok} upserts processados.")


if __name__ == "__main__":
    main()
