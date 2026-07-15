#!/usr/bin/env python3
"""
Teste E2E de dados — plano de agenda do paciente (ex.: Airton Tonelo).

  python scripts/test-plano-agenda-paciente.py
  python scripts/test-plano-agenda-paciente.py --nome "Airton Tonelo"
  python scripts/test-plano-agenda-paciente.py --mes 7 --ano 2026
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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env


def req(method: str, url: str, headers: dict, body=None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def admin_headers() -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def parse_dias_semana_pt(texto: str | None) -> list[int]:
    if not texto or not texto.strip():
        return []
    n = (
        texto.lower()
        .encode("ascii", "ignore")
        .decode()
        .replace("ª", "")
    )
    m = re.search(r"(\d)\s*a\s*(\d)", n)
    if m:
        ini, fim = int(m.group(1)), int(m.group(2))
        if 2 <= ini <= fim <= 6:
            return list(range(ini - 1, fim))
    dias = sorted({int(x) - 1 for x in re.findall(r"\b([2-6])\b", n)})
    return dias


def sessoes_por_visita(dias_semana: str | None, frequencia: str | None) -> int:
    t = (dias_semana or frequencia or "").lower()
    if "triplo" in t:
        return 3
    if "duplo" in t:
        return 2
    return 1


def gerar_slots_plano(mes: int, ano: int, qtd: int, dias_semana: str | None, frequencia: str | None) -> list[dict]:
    dias_pt = parse_dias_semana_pt(dias_semana)
    if not dias_pt or qtd <= 0:
        return []
    por_visita = sessoes_por_visita(dias_semana, frequencia)
    import calendar

    ultimo = calendar.monthrange(ano, mes)[1]
    slots = []
    for dia in range(1, ultimo + 1):
        from datetime import date

        wd = date(ano, mes, dia).weekday()  # Mon=0 … Sun=6 — alinhar com JS getDay() Sun=0
        js_wd = (wd + 1) % 7  # Sun=0, Mon=1 …
        if js_wd not in dias_pt:
            continue
        for s in range(1, por_visita + 1):
            if len(slots) >= qtd:
                return slots
            slots.append(
                {
                    "dataIso": f"{ano}-{mes:02d}-{dia:02d}",
                    "sessaoNoDia": s,
                }
            )
    return slots


def contar_por_data(agendamentos: list[dict]) -> dict[str, int]:
    out: dict[str, int] = {}
    for ag in agendamentos:
        d = (ag.get("inicio") or "")[:10]
        if d:
            out[d] = out.get(d, 0) + 1
    return out


def filtrar_faltantes(slots: list[dict], agendamentos: list[dict]) -> list[dict]:
    por_data = contar_por_data(agendamentos)
    consumido: dict[str, int] = {}
    faltantes = []
    for slot in slots:
        data = slot["dataIso"]
        total = por_data.get(data, 0)
        usado = consumido.get(data, 0)
        if usado >= total:
            faltantes.append(slot)
        else:
            consumido[data] = usado + 1
    return faltantes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nome", default="Airton Tonelo")
    parser.add_argument("--mes", type=int, default=7)
    parser.add_argument("--ano", type=int, default=2026)
    args = parser.parse_args()

    load_app_env()
    base = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    if not base.startswith("http"):
        print("SUPABASE_URL ausente", file=sys.stderr)
        return 1

    h = admin_headers()
    nome_q = urllib.parse.quote(f"%{args.nome}%")
    code, pacientes = req("GET", f"{base}/rest/v1/pacientes?select=id,nome,frequencia_atendimento,dias_semana,ativo&nome=ilike.{nome_q}&limit=5", h)
    if code >= 400 or not pacientes:
        print(f"Paciente não encontrado ({code}): {pacientes}", file=sys.stderr)
        return 1

    paciente = pacientes[0]
    if len(pacientes) > 1:
        print(f"Aviso: {len(pacientes)} pacientes encontrados, usando o primeiro.")

    pid = paciente["id"]
    inicio = f"{args.ano}-{args.mes:02d}-01"
    fim_mes = args.mes + 1 if args.mes < 12 else 1
    fim_ano = args.ano if args.mes < 12 else args.ano + 1
    fim = f"{fim_ano}-{fim_mes:02d}-01"

    code, cobranca = req(
        "GET",
        f"{base}/rest/v1/cobrancas?select=qtd_sessoes,frequencia_atendimento,dias_semana&paciente_id=eq.{pid}&competencia_mes=eq.{args.mes}&competencia_ano=eq.{args.ano}&limit=1",
        h,
    )
    cob = (cobranca or [{}])[0] if isinstance(cobranca, list) else {}

    freq = (cob.get("frequencia_atendimento") or paciente.get("frequencia_atendimento") or "").strip() or None
    dias = (cob.get("dias_semana") or paciente.get("dias_semana") or "").strip() or None
    qtd = cob.get("qtd_sessoes")

    if not qtd or qtd <= 0:
        m = re.search(r"(\d+)\s*x\s*semana", (freq or "").lower())
        mult = 3 if freq and "triplo" in freq.lower() else 2 if freq and "duplo" in freq.lower() else 1
        if m:
            qtd = int(m.group(1)) * mult * 4

    code, ags = req(
        "GET",
        f"{base}/rest/v1/agendamentos?select=id,inicio,status&paciente_id=eq.{pid}&inicio=gte.{inicio}T00:00:00&inicio=lt.{fim}T00:00:00&status=in.(agendado,confirmado,realizado,faltou)&order=inicio",
        h,
    )
    agendamentos = ags if isinstance(ags, list) else []

    print(f"\n=== Teste plano agenda — {paciente['nome']} ===")
    print(f"Competência: {args.mes:02d}/{args.ano}")
    print(f"frequencia_atendimento: {freq or '—'}")
    print(f"dias_semana: {dias or '—'}")
    print(f"qtd_sessoes (cobrança): {cob.get('qtd_sessoes') or '—'}")
    print(f"quantidadeMensal usada: {qtd or '—'}")
    print(f"agendamentos no mês: {len(agendamentos)}")

    ok = True
    if not dias:
        print("\nFALHA: dias_semana não cadastrado — fluxo em lote usará fallback limitado.")
        ok = False
    if not freq:
        print("AVISO: frequencia_atendimento ausente.")

    if not qtd:
        print("FALHA: não foi possível resolver quantidade mensal do plano.")
        return 1

    slots = gerar_slots_plano(args.mes, args.ano, int(qtd), dias, freq)
    faltantes = filtrar_faltantes(slots, agendamentos)

    print(f"\nSlots esperados no plano: {len(slots)}")
    print(f"Faltantes (propostas de agendamento): {len(faltantes)}")
    print(f"Por visita (triplo/duplo/simples): {sessoes_por_visita(dias, freq)}")
    print(f"Dias da semana (JS): {parse_dias_semana_pt(dias)}")

    if len(slots) != int(qtd):
        print(f"FALHA: esperava {qtd} slots, gerou {len(slots)}")
        ok = False
    elif len(faltantes) == 0 and len(agendamentos) < int(qtd):
        print("FALHA: há vagas no plano mas nenhuma proposta faltante.")
        ok = False
    elif len(faltantes) > 1:
        print("\nPrimeiras 6 propostas:")
        for slot in faltantes[:6]:
            print(f"  · {slot['dataIso']} sessão {slot['sessaoNoDia']} no dia")
        if len(faltantes) > 6:
            print(f"  … +{len(faltantes) - 6} horários")

    if agendamentos:
        print("\nAgendamentos existentes:")
        for ag in agendamentos[:8]:
            print(f"  · {ag['inicio'][:10]} ({ag['status']})")
        if len(agendamentos) > 8:
            print(f"  … +{len(agendamentos) - 8}")

    if ok and len(faltantes) > 1:
        print(f"\nOK — pronto para 'Agendar {len(faltantes)} sessões faltantes' no modal.")
        return 0
    if ok and len(faltantes) <= 1:
        print("\nOK — plano praticamente completo (0–1 faltante).")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
