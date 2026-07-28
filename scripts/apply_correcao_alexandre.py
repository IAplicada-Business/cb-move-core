#!/usr/bin/env python3
"""Correção piloto Alexandre Pires — valor_mensal + cobranças R5."""
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

PACIENTE_ID = "8a38b632-98d7-401a-87ca-73b36e6bbcb6"
VALOR_MENSAL_CORRETO = 10280.0

# Depósitos R5 — atualizar para mensal cheio
COBRANCAS_CORRIGIR_VALOR = [
    "0daf1342",  # fev — prefixo id, resolve abaixo
    "731e1e6d",  # mar
    "8c4a0151",  # mai
    "97a21538",  # jun
]

# Jul/2026 já tem boleto R$ 10.280 pendente — cancelar depósito duplicado R5
COBRANCA_CANCELAR_JUL_DEPOSITO = "a530f5b6"


def patch(sb: Supa, table: str, filt: str, patch: dict) -> None:
    path = f"{table}?{filt}"
    data = json.dumps(patch).encode()
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
        body = res.read().decode()
        return json.loads(body) if body else []


def resolve_ids(sb: Supa, prefixes: list[str]) -> dict[str, str]:
    cobs = sb.fetch_all(
        "cobrancas",
        "id,competencia_mes,competencia_ano,valor,status,forma_pagamento",
        f"paciente_id=eq.{PACIENTE_ID}&status=neq.cancelado",
    )
    out: dict[str, str] = {}
    for prefix in prefixes:
        matches = [c for c in cobs if c["id"].startswith(prefix)]
        if len(matches) != 1:
            raise SystemExit(f"Prefixo {prefix}: {len(matches)} matches (esperado 1)")
        out[prefix] = matches[0]["id"]
    cancel = [c for c in cobs if c["id"].startswith(COBRANCA_CANCELAR_JUL_DEPOSITO)]
    if len(cancel) != 1:
        raise SystemExit(f"Cancel jul: {len(cancel)} matches")
    out["cancel_jul"] = cancel[0]["id"]
    return out


def main() -> int:
    load_app_env()
    sb = Supa()

    pac = sb._req("GET", f"pacientes?id=eq.{PACIENTE_ID}&select=*")
    cobs = sb.fetch_all(
        "cobrancas",
        "id,competencia_mes,competencia_ano,valor,status,forma_pagamento,observacoes,servico",
        f"paciente_id=eq.{PACIENTE_ID}",
    )
    nfs = sb.fetch_all(
        "notas_fiscais",
        "id,cobranca_id,status,valor,competencia_mes,competencia_ano",
        f"paciente_id=eq.{PACIENTE_ID}&status=neq.cancelada",
    )

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    backup_path = Path(__file__).resolve().parent / "out" / f"backup-alexandre-{ts}.json"
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_text(
        json.dumps(
            {"paciente": pac, "cobrancas": cobs, "notas_fiscais": nfs},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Backup: {backup_path}")

    ids = resolve_ids(sb, COBRANCAS_CORRIGIR_VALOR)
    cancel_id = ids["cancel_jul"]

    # 1) valor_mensal
    patch(sb, "pacientes", f"id=eq.{PACIENTE_ID}", {"valor_mensal": VALOR_MENSAL_CORRETO})
    print(f"valor_mensal -> R$ {VALOR_MENSAL_CORRETO:,.2f}")

    # 2) Corrigir valores R5
    nota = " - valor corrigido piloto Alexandre (R5->mensal cheio R$ 10.280,00)"
    for prefix, cid in ids.items():
        if prefix == "cancel_jul":
            continue
        cob = next(c for c in cobs if c["id"] == cid)
        obs = (cob.get("observacoes") or "").strip()
        if nota.strip(" —") not in obs:
            obs = f"{obs}{nota}".strip(" —")
        updated = patch(
            sb,
            "cobrancas",
            f"id=eq.{cid}",
            {
                "valor": VALOR_MENSAL_CORRETO,
                "observacoes": obs,
                "status": "pendente" if cob["status"] in ("atrasado", "vencido") else cob["status"],
            },
        )
        c = updated[0] if updated else {}
        print(
            f"  {c.get('competencia_mes')}/{c.get('competencia_ano')}: "
            f"R$ {float(cob['valor']):.2f} -> R$ {VALOR_MENSAL_CORRETO:.2f} ({c.get('status')})"
        )

    # 3) Cancelar depósito jul duplicado (boleto 10.280 já existe)
    cob_jul = next(c for c in cobs if c["id"] == cancel_id)
    obs_cancel = (
        f"{cob_jul.get('observacoes') or ''} — cancelada: duplicata R5; "
        f"mês jul/2026 já faturado via boleto R$ 10.280"
    ).strip(" —")
    patch(
        sb,
        "cobrancas",
        f"id=eq.{cancel_id}",
        {"status": "cancelado", "observacoes": obs_cancel},
    )
    print(f"  07/2026 deposito R$ {float(cob_jul['valor']):.2f} -> cancelado (duplicata)")

    # 4) NFs vinculadas com valor R5 antigo
    nf_fixes = [
        ("341c7238-759b-4eac-b7a7-ed019516d39a", {"valor": VALOR_MENSAL_CORRETO}, "jun NF valor"),
        ("ccf6c395-aced-494c-8ec4-2383abc2ba55", {"status": "cancelada"}, "jul NF cancelada"),
    ]
    for nf_id, nf_patch, label in nf_fixes:
        patch(sb, "notas_fiscais", f"id=eq.{nf_id}", nf_patch)
        print(f"  NF {label}: {nf_id[:8]}…")

    # Verificação
    pac2 = sb._req("GET", f"pacientes?id=eq.{PACIENTE_ID}&select=nome,valor_mensal")
    cobs2 = sb.fetch_all(
        "cobrancas",
        "competencia_mes,competencia_ano,valor,status,forma_pagamento",
        f"paciente_id=eq.{PACIENTE_ID}&status=neq.cancelado&order=competencia_ano,competencia_mes",
    )
    print("\n--- Após correção ---")
    print("valor_mensal:", pac2[0]["valor_mensal"])
    for c in cobs2:
        print(
            f"  {c['competencia_mes']:02d}/{c['competencia_ano']} "
            f"R$ {float(c['valor']):,.2f} {c['status']} {c.get('forma_pagamento')}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
