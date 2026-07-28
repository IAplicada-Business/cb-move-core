#!/usr/bin/env python3
"""
Corrige valores retroativos suspeitos (R5 antigo) e opcionalmente deduplica competências.

  python scripts/fix_retroativos_r5.py --dry-run
  python scripts/fix_retroativos_r5.py --apply --paciente-id 8a38b632-98d7-401a-87ca-73b36e6bbcb6
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env
from audit_retroativos import Supa
from lib.retroativos_valor import calc_valor_retroativo, is_r5_suspect


def patch_cobranca(sb: Supa, cob_id: str, patch: dict, dry_run: bool) -> None:
    if dry_run:
        print(f"  [dry-run] PATCH cobrancas/{cob_id}: {patch}")
        return
    path = f"cobrancas?id=eq.{cob_id}"
    data = json.dumps(patch).encode()
    req = urllib.request.Request(
        f"{sb.url}/rest/v1/{urllib.parse.quote(path, safe='/?&=(),.*:_-')}",
        data=data,
        headers={
            "apikey": sb.key,
            "Authorization": f"Bearer {sb.key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        if res.status not in (200, 204):
            raise RuntimeError(f"PATCH falhou: HTTP {res.status}")


def run(paciente_id: str | None, ano: int | None, apply: bool) -> int:
    sb = Supa()
    dry_run = not apply

    pacientes = sb.fetch_all("pacientes", "id,nome,valor_mensal")
    pac_by_id = {p["id"]: p for p in pacientes}

    filt = "or=(status.eq.regularizar_retroativa,observacoes.ilike.*Retroativa*,servico.ilike.*retroativa*)"
    if paciente_id:
        filt += f"&paciente_id=eq.{paciente_id}"
    if ano:
        filt += f"&competencia_ano=eq.{ano}"

    cobrancas = sb.fetch_all(
        "cobrancas",
        "id,paciente_id,competencia_mes,competencia_ano,valor,status,servico,observacoes,created_at",
        filt,
    )

    fixes: list[dict] = []
    for c in cobrancas:
        pac = pac_by_id.get(c.get("paciente_id") or "")
        vm = pac.get("valor_mensal") if pac else None
        vm_f = float(vm) if vm is not None else None
        val = float(c.get("valor") or 0)
        if not is_r5_suspect(val, vm_f):
            continue
        novo = calc_valor_retroativo(vm_f, val)
        fixes.append(
            {
                "id": c["id"],
                "paciente": pac.get("nome") if pac else c.get("paciente_id"),
                "competencia": f"{c.get('competencia_mes')}/{c.get('competencia_ano')}",
                "valor_atual": val,
                "valor_novo": novo,
            }
        )
        patch_cobranca(
            sb,
            c["id"],
            {
                "valor": novo,
                "observacoes": (
                    f"{c.get('observacoes') or ''} — valor corrigido R5→mensal cheio ({novo:.2f})"
                ).strip(" —"),
            },
            dry_run,
        )

    dup_groups: dict[str, list[dict]] = defaultdict(list)
    for c in cobrancas:
        if c.get("status") == "cancelado":
            continue
        key = f"{c.get('paciente_id')}|{c.get('competencia_mes')}|{c.get('competencia_ano')}|{float(c.get('valor') or 0)}"
        dup_groups[key].append(c)

    dedupes: list[dict] = []
    for key, group in dup_groups.items():
        if len(group) < 2:
            continue
        ordered = sorted(group, key=lambda x: x.get("created_at") or "")
        keep = ordered[0]
        for extra in ordered[1:]:
            dedupes.append(
                {
                    "id": extra["id"],
                    "keep_id": keep["id"],
                    "paciente_id": extra.get("paciente_id"),
                    "competencia": f"{extra.get('competencia_mes')}/{extra.get('competencia_ano')}",
                }
            )
            patch_cobranca(
                sb,
                extra["id"],
                {
                    "status": "cancelado",
                    "observacoes": (
                        f"{extra.get('observacoes') or ''} — duplicata cancelada (mantida {keep['id'][:8]})"
                    ).strip(" —"),
                },
                dry_run,
            )

    modo = "APLICAR" if apply else "DRY-RUN"
    print(f"[{modo}] Cobranças retroativas analisadas: {len(cobrancas)}")
    print(f"  Correções R5: {len(fixes)}")
    print(f"  Deduplicações: {len(dedupes)}")

    for row in fixes[:10]:
        print(
            f"  R5 {row['paciente']} {row['competencia']}: "
            f"R$ {row['valor_atual']} → R$ {row['valor_novo']}"
        )
    for row in dedupes[:10]:
        print(f"  DEDUP {row['competencia']} cancela {row['id'][:8]}… mantém {row['keep_id'][:8]}…")

    if not apply and (fixes or dedupes):
        print("\nUse --apply para persistir as alterações.")
    return 0


def main() -> int:
    load_app_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Persistir alterações (padrão: dry-run)")
    ap.add_argument("--paciente-id", default="", help="Limitar a um paciente (ex.: Alexandre)")
    ap.add_argument("--ano", type=int, default=2026)
    args = ap.parse_args()
    return run(args.paciente_id or None, args.ano, args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
