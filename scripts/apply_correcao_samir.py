#!/usr/bin/env python3
"""Correção cobranças Samir Martins Arrage — duplicatas LogJur."""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env
from audit_retroativos import Supa

PACIENTE_ID = "ee171e6a-538e-48a0-bb56-b284c55c36c3"
VALOR_DEPOSITO_JUN = 4256.0
COMP_JUN_MES = 6
COMP_JUN_ANO = 2026
# Depósito direto do paciente — tipo particular (distinto de cobrança convênio/sharepoint)
TIPO_DEPOSITO_PACIENTE = "particular"


def patch(sb: Supa, table: str, filt: str, body: dict) -> list:
    path = f"{table}?{filt}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{sb.url}/rest/v1/{urllib.parse.quote(path, safe='/?&=(),.*:_-')}",
        data=data,
        headers={
            "apikey": sb.key,
            "Authorization": f"Bearer {sb.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        raw = res.read().decode()
        return json.loads(raw) if raw else []


def post(sb: Supa, table: str, body: dict) -> list:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{sb.url}/rest/v1/{table}",
        data=data,
        headers={
            "apikey": sb.key,
            "Authorization": f"Bearer {sb.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        raw = res.read().decode()
        return json.loads(raw) if raw else []


def is_sharepoint(cob: dict) -> bool:
    obs = (cob.get("observacoes") or "").upper()
    status = cob.get("status") or ""
    return "SHAREPOINT" in obs or status == "aguardando_convenio"


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    load_app_env()
    sb = Supa()

    pac = sb._req("GET", f"pacientes?id=eq.{PACIENTE_ID}&select=*")
    if not pac:
        raise SystemExit(f"Paciente {PACIENTE_ID} não encontrado")
    paciente = pac[0]

    cobs = sb.fetch_all(
        "cobrancas",
        "id,competencia_mes,competencia_ano,valor,status,forma_pagamento,observacoes,regime,tipo",
        f"paciente_id=eq.{PACIENTE_ID}",
    )
    nfs = sb.fetch_all(
        "notas_fiscais",
        "id,cobranca_id,status,valor,competencia_mes,competencia_ano",
        f"paciente_id=eq.{PACIENTE_ID}&status=neq.cancelada",
    )

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    backup_path = Path(__file__).resolve().parent / "out" / f"backup-samir-{ts}.json"
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_text(
        json.dumps({"paciente": pac, "cobrancas": cobs, "notas_fiscais": nfs}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Backup: {backup_path}")

    actions: list[str] = []

    # 1) Cancelar cobrança errônea R$ 17.177 (se existir)
    for cob in cobs:
        if float(cob["valor"]) == 17177.0 and cob["status"] != "cancelado":
            nf_linked = [n for n in nfs if n.get("cobranca_id") == cob["id"]]
            if nf_linked:
                print(f"AVISO: cobrança 17177 tem NF vinculada — revisar manualmente: {cob['id']}")
                continue
            actions.append(f"cancelar 17177 ({cob['id'][:8]}… comp {cob['competencia_mes']}/{cob['competencia_ano']})")
            if not dry_run:
                obs = f"{cob.get('observacoes') or ''} — cancelada: valor incorreto (soma acumulada LogJur)".strip(" —")
                patch(sb, "cobrancas", f"id=eq.{cob['id']}", {"status": "cancelado", "observacoes": obs})

    # 2) Jun/2026 depósito R$ 4.256 — marcar pago ou criar registro
    jun_paciente = [
        c
        for c in cobs
        if c["competencia_mes"] == COMP_JUN_MES
        and c["competencia_ano"] == COMP_JUN_ANO
        and float(c["valor"]) == VALOR_DEPOSITO_JUN
        and not is_sharepoint(c)
        and c["status"] != "cancelado"
    ]
    jun_pago = [c for c in jun_paciente if c["status"] == "pago"]

    if jun_pago:
        cob = jun_pago[0]
        print(f"Jun/2026 R$ {VALOR_DEPOSITO_JUN:,.2f} já consta como pago ({cob['id'][:8]}…)")
        if cob.get("tipo") != TIPO_DEPOSITO_PACIENTE:
            actions.append(f"corrigir tipo depósito → {TIPO_DEPOSITO_PACIENTE} ({cob['id'][:8]}…)")
            if not dry_run:
                patch(sb, "cobrancas", f"id=eq.{cob['id']}", {"tipo": TIPO_DEPOSITO_PACIENTE})
    elif jun_paciente:
        cob = jun_paciente[0]
        actions.append(f"marcar jun/2026 4256 pago ({cob['id'][:8]}…)")
        if not dry_run:
            patch(
                sb,
                "cobrancas",
                f"id=eq.{cob['id']}",
                {"status": "pago", "forma_pagamento": "deposito", "tipo": TIPO_DEPOSITO_PACIENTE},
            )
    else:
        actions.append(f"criar jun/2026 R$ {VALOR_DEPOSITO_JUN:,.2f} pago (depósito paciente)")
        if not dry_run:
            post(
                sb,
                "cobrancas",
                {
                    "paciente_id": PACIENTE_ID,
                    "valor": VALOR_DEPOSITO_JUN,
                    "competencia_mes": COMP_JUN_MES,
                    "competencia_ano": COMP_JUN_ANO,
                    "status": "pago",
                    "forma_pagamento": "deposito",
                    "regime": paciente.get("regime_cobranca") or paciente.get("regime") or "por_sessao",
                    "tipo": TIPO_DEPOSITO_PACIENTE,
                    "observacoes": "Depósito paciente jun/2026 — correção Samir (em dia)",
                },
            )

    # 3) Cancelar duplicatas R$ 4.256 pendentes fora de jun (mantém 1 pago)
    dup_4256 = [
        c
        for c in cobs
        if float(c["valor"]) == VALOR_DEPOSITO_JUN
        and c["status"] in ("pendente", "atrasado", "vencido")
        and not is_sharepoint(c)
        and not (c["competencia_mes"] == COMP_JUN_MES and c["competencia_ano"] == COMP_JUN_ANO)
    ]
    for cob in dup_4256:
        nf_linked = [n for n in nfs if n.get("cobranca_id") == cob["id"]]
        if nf_linked:
            continue
        actions.append(
            f"cancelar duplicata 4256 ({cob['id'][:8]}… comp {cob['competencia_mes']}/{cob['competencia_ano']})"
        )
        if not dry_run:
            obs = f"{cob.get('observacoes') or ''} — cancelada: duplicata migração LogJur".strip(" —")
            patch(sb, "cobrancas", f"id=eq.{cob['id']}", {"status": "cancelado", "observacoes": obs})

    prefix = "[dry-run] " if dry_run else ""
    if not actions:
        print("Nenhuma alteração necessária — estado já consistente.")
    else:
        for a in actions:
            print(f"{prefix}{a}")

    cobs2 = sb.fetch_all(
        "cobrancas",
        "competencia_mes,competencia_ano,valor,status,forma_pagamento,observacoes",
        f"paciente_id=eq.{PACIENTE_ID}&status=neq.cancelado&order=competencia_ano,competencia_mes",
    )
    print("\n--- Cobranças ativas após correção ---")
    for c in cobs2:
        obs = (c.get("observacoes") or "")[:50]
        print(
            f"  {c['competencia_mes']:02d}/{c['competencia_ano']} "
            f"R$ {float(c['valor']):,.2f} {c['status']} {c.get('forma_pagamento') or ''} {obs}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
