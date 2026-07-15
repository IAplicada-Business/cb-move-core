#!/usr/bin/env python3
"""
Teste de integração — RPC remarcar_agendamentos_lote (atomicidade + rollback).

  python scripts/test-remarcar-atomic.py
  python scripts/test-remarcar-atomic.py --keep-data

Cenários:
  1. RPC existe
  2. Falha de validação (escopo inválido) → nenhuma alteração nos agendamentos de teste
  3. Falha de permissão (sem JWT) → nenhuma alteração
  4. Sucesso pontual → antigo vira remarcacao, novo criado, histórico gravado
  5. Sucesso em lote (semana) → todos os elegíveis remarcados juntos
  6. Rollback forçado (trigger no 2º INSERT) → nenhum agendamento parcialmente remarcado
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

TZ = ZoneInfo("America/Sao_Paulo")
ADMIN_EMAIL = "mariana@iaplicada.com"
TEST_CANAL = "test_atomic_remarcar"
SERVICO_TESTE_REMARCAR = "Teste atomicidade remarcar"
FAIL_FLAG = "remarcar_fail_on_second_insert"


def req(method: str, url: str, headers: dict, body: dict | list | None = None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as res:
            raw = res.read().decode()
            if not raw:
                return res.status, None
            try:
                return res.status, json.loads(raw)
            except json.JSONDecodeError:
                return res.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def admin_headers() -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def user_jwt(base: str) -> str:
    h = admin_headers()
    code, data = req("POST", f"{base}/auth/v1/admin/generate_link", h, {"type": "magiclink", "email": ADMIN_EMAIL})
    if code >= 400:
        raise RuntimeError(f"generate_link falhou ({code}): {data}")
    props = (data or {}).get("properties") or data or {}
    token_hash = props.get("hashed_token") or props.get("token_hash")
    anon = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    code2, sess = req(
        "POST",
        f"{base}/auth/v1/verify",
        {"apikey": anon, "Content-Type": "application/json"},
        {"type": "magiclink", "token_hash": token_hash},
    )
    if code2 >= 400:
        raise RuntimeError(f"verify falhou ({code2}): {sess}")
    token = (sess or {}).get("access_token")
    if not token:
        raise RuntimeError(f"verify sem access_token: {sess}")
    return token


def rest(
    base: str,
    path: str,
    *,
    method: str = "GET",
    body=None,
    jwt: str | None = None,
    prefer: str | None = None,
) -> tuple[int, object]:
    h = admin_headers() if jwt is None else {
        "apikey": os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY"),
        "Authorization": f"Bearer {jwt}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    safe = urllib.parse.quote(path, safe="/?&=(),.*:_-")
    return req(method, f"{base}/rest/v1/{safe}", h, body)


def rpc(base: str, name: str, args: dict, jwt: str | None) -> tuple[int, object]:
    h = admin_headers() if jwt is None else {
        "apikey": os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY"),
        "Authorization": f"Bearer {jwt}",
        "Content-Type": "application/json",
    }
    return req("POST", f"{base}/rest/v1/rpc/{name}", h, args)


def mgmt_sql(sql: str) -> tuple[int, object]:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("SUPABASE_ACCESS_TOKEN ausente em .env.app")
    url = "https://api.supabase.com/v1/projects/grlkbtnwvxorlfglyzid/database/query"
    return req(
        "POST",
        url,
        {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        {"query": sql},
    )


@dataclass
class TestFixture:
    paciente_id: str
    fisio_id: str
    ag_ids: list[str]
    sessao_data: str | None = None


def iso_inicio(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def next_monday_10h() -> datetime:
    now = datetime.now(TZ)
    days_ahead = (7 - now.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    monday = (now + timedelta(days=days_ahead)).replace(hour=10, minute=0, second=0, microsecond=0)
    return monday


def pick_refs(base: str) -> tuple[str, str]:
    code, pacientes = rest(base, "pacientes?select=id&ativo=eq.true&limit=1")
    if code >= 400 or not pacientes:
        raise RuntimeError(f"paciente de teste não encontrado ({code}): {pacientes}")
    code, fisios = rest(base, "fisioterapeutas?select=id&limit=1")
    if code >= 400 or not fisios:
        raise RuntimeError(f"fisio de teste não encontrado ({code}): {fisios}")
    return pacientes[0]["id"], fisios[0]["id"]


def cleanup(base: str, fixture: TestFixture | None) -> None:
    rest(base, f"agendamentos?canal_origem=eq.{TEST_CANAL}", method="DELETE")
    svc = urllib.parse.quote(SERVICO_TESTE_REMARCAR)
    rest(base, f"agendamentos?servico=eq.{svc}", method="DELETE")
    mgmt_sql(
        f"""
        DELETE FROM public.sessoes s
        USING public.agendamentos a
        WHERE a.canal_origem = '{TEST_CANAL}'
          AND s.paciente_id = a.paciente_id;
        DELETE FROM public.sessoes s
        WHERE s.paciente_id IN (
          SELECT DISTINCT paciente_id FROM public.agendamentos
          WHERE servico = '{SERVICO_TESTE_REMARCAR}'
        );
        DROP TRIGGER IF EXISTS trg_test_block_2nd_remanejamento ON public.agendamentos;
        DROP FUNCTION IF EXISTS public._test_block_2nd_remanejamento();
        DELETE FROM public._cbmove_test_flags WHERE key = '{FAIL_FLAG}';
        """
    )


def setup_trigger() -> None:
    sql = f"""
    CREATE TABLE IF NOT EXISTS public._cbmove_test_flags (
      key text PRIMARY KEY,
      value text NOT NULL
    );

    CREATE OR REPLACE FUNCTION public._test_block_2nd_remanejamento()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_fail text;
      v_recent int;
    BEGIN
      SELECT value INTO v_fail FROM public._cbmove_test_flags WHERE key = '{FAIL_FLAG}';
      IF v_fail IS DISTINCT FROM 'on' THEN
        RETURN NEW;
      END IF;
      IF NEW.canal_origem = 'remanejamento' THEN
        SELECT count(*) INTO v_recent
        FROM public.agendamentos
        WHERE canal_origem = 'remanejamento'
          AND paciente_id = NEW.paciente_id
          AND remarcado_de_id IN (
            SELECT id FROM public.agendamentos WHERE canal_origem = '{TEST_CANAL}'
          );
        IF v_recent >= 1 THEN
          RAISE EXCEPTION 'CBMOVE_TEST_FORCED_REMARCAR_FAIL';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_test_block_2nd_remanejamento ON public.agendamentos;
    CREATE TRIGGER trg_test_block_2nd_remanejamento
      BEFORE INSERT ON public.agendamentos
      FOR EACH ROW
      EXECUTE FUNCTION public._test_block_2nd_remanejamento();
    """
    code, out = mgmt_sql(sql)
    if code >= 400:
        raise RuntimeError(f"setup trigger falhou ({code}): {out}")


def set_fail_flag(on: bool) -> None:
    val = "on" if on else "off"
    sql = f"""
    INSERT INTO public._cbmove_test_flags (key, value)
    VALUES ('{FAIL_FLAG}', '{val}')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    """
    code, out = mgmt_sql(sql)
    if code >= 400:
        raise RuntimeError(f"set_fail_flag falhou ({code}): {out}")


def create_fixture(base: str) -> TestFixture:
    paciente_id, fisio_id = pick_refs(base)
    monday = next_monday_10h()
    wednesday = monday + timedelta(days=2)

    rows = [
        {
            "paciente_id": paciente_id,
            "fisioterapeuta_id": fisio_id,
            "inicio": iso_inicio(monday),
            "duracao_min": 50,
            "status": "agendado",
            "canal_origem": TEST_CANAL,
            "servico": "Teste atomicidade remarcar",
        },
        {
            "paciente_id": paciente_id,
            "fisioterapeuta_id": fisio_id,
            "inicio": iso_inicio(wednesday),
            "duracao_min": 50,
            "status": "agendado",
            "canal_origem": TEST_CANAL,
            "servico": "Teste atomicidade remarcar",
        },
    ]
    code, created = rest(
        base,
        "agendamentos",
        method="POST",
        body=rows,
        prefer="return=representation",
    )
    if code >= 400 or not created:
        raise RuntimeError(f"criar agendamentos de teste falhou ({code}): {created}")

    ag_ids = [r["id"] for r in created]
    sessao_data = monday.date().isoformat()
    code, _ = rest(
        base,
        "sessoes",
        method="POST",
        body={
            "paciente_id": paciente_id,
            "fisioterapeuta_id": fisio_id,
            "data": sessao_data,
            "sigla": "FJ",
            "hora": "10:00:00",
        },
        prefer="return=minimal",
    )
    if code >= 400:
        raise RuntimeError(f"criar sessao de teste falhou ({code})")

    return TestFixture(paciente_id=paciente_id, fisio_id=fisio_id, ag_ids=ag_ids, sessao_data=sessao_data)


def snapshot(base: str, fixture: TestFixture) -> dict:
    ids = ",".join(fixture.ag_ids)
    code, ags = rest(base, f"agendamentos?id=in.({ids})&select=id,status,remarcado_para_id,inicio")
    if code >= 400:
        raise RuntimeError(f"snapshot agendamentos falhou ({code}): {ags}")

    hist_filter = ",".join(fixture.ag_ids)
    code2, hist = rest(
        base,
        f"agendamento_historico?agendamento_id=in.({hist_filter})&select=id",
    )
    code3, sessoes = rest(
        base,
        f"sessoes?paciente_id=eq.{fixture.paciente_id}&data=eq.{fixture.sessao_data}&select=id,sigla,data",
    )
    code4, remanej = rest(
        base,
        f"agendamentos?canal_origem=eq.remanejamento&paciente_id=eq.{fixture.paciente_id}&select=id",
    )
    return {
        "agendamentos": sorted(ags or [], key=lambda x: x["id"]),
        "historico_count": len(hist or []),
        "sessoes": sessoes or [],
        "remanejamento_count": len(remanej or []),
    }


def assert_snapshot_unchanged(before: dict, after: dict, label: str) -> None:
    if before != after:
        raise AssertionError(
            f"{label}: estado alterado após falha esperada\n"
            f"antes={json.dumps(before, ensure_ascii=False)}\n"
            f"depois={json.dumps(after, ensure_ascii=False)}"
        )


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def run_tests(base: str, keep_data: bool) -> None:
    jwt = user_jwt(base)
    fixture: TestFixture | None = None
    passed = 0

    try:
        cleanup(base, None)
        fixture = create_fixture(base)
        print(f"Fixture: paciente={fixture.paciente_id[:8]}… ags={fixture.ag_ids}")

        # 1) RPC existe
        code, out = rpc(
            base,
            "remarcar_agendamentos_lote",
            {
                "p_agendamento_id": fixture.ag_ids[0],
                "p_novo_inicio": iso_inicio(next_monday_10h() + timedelta(days=7)),
                "p_escopo": "invalido",
            },
            jwt,
        )
        assert_true(code >= 400, f"esperava erro com escopo inválido, got {code}: {out}")
        print("OK 1/6 — RPC responde (escopo inválido rejeitado)")
        passed += 1

        before = snapshot(base, fixture)

        # 2) Falha validação → sem alteração
        code, out = rpc(
            base,
            "remarcar_agendamentos_lote",
            {
                "p_agendamento_id": fixture.ag_ids[0],
                "p_novo_inicio": iso_inicio(next_monday_10h() + timedelta(days=7)),
                "p_escopo": "invalido",
            },
            jwt,
        )
        assert_true(code >= 400, f"escopo inválido deveria falhar: {out}")
        after = snapshot(base, fixture)
        assert_snapshot_unchanged(before, after, "falha de validação")
        print("OK 2/6 — falha de validação não alterou dados")
        passed += 1

        # 3) Sem JWT → sem alteração
        code, out = rpc(
            base,
            "remarcar_agendamentos_lote",
            {
                "p_agendamento_id": fixture.ag_ids[0],
                "p_novo_inicio": iso_inicio(next_monday_10h() + timedelta(days=7)),
                "p_escopo": "pontual",
            },
            None,
        )
        assert_true(code >= 400, f"sem JWT deveria falhar: {out}")
        after = snapshot(base, fixture)
        assert_snapshot_unchanged(before, after, "falha de permissão")
        print("OK 3/6 — falha de permissão não alterou dados")
        passed += 1

        # 4) Sucesso pontual
        novo_inicio = iso_inicio(next_monday_10h() + timedelta(days=7))
        code, out = rpc(
            base,
            "remarcar_agendamentos_lote",
            {
                "p_agendamento_id": fixture.ag_ids[0],
                "p_novo_inicio": novo_inicio,
                "p_escopo": "pontual",
            },
            jwt,
        )
        assert_true(code < 400, f"pontual deveria suceder: {code} {out}")
        result = out or {}
        assert_true(result.get("count") == 1, f"count esperado 1, got {result}")
        novo_id = result.get("primeiro_novo_id")
        assert_true(bool(novo_id), "primeiro_novo_id ausente")

        code, ag0 = rest(base, f"agendamentos?id=eq.{fixture.ag_ids[0]}&select=status,remarcado_para_id")
        assert_true(ag0 and ag0[0]["status"] == "remarcacao", "ag0 deveria estar remarcacao")
        assert_true(ag0[0]["remarcado_para_id"] == novo_id, "vínculo remarcado_para_id incorreto")

        code, hist = rest(
            base,
            f"agendamento_historico?agendamento_id=in.({fixture.ag_ids[0]},{novo_id})&select=acao",
        )
        assert_true(len(hist or []) >= 2, "histórico de remanejamento ausente")
        print("OK 4/6 — remarcação pontual com sucesso")
        passed += 1

        # 5) Lote semana (só ag2 ainda ativo na mesma semana)
        delta_days = 7
        novo_inicio_lote = iso_inicio(next_monday_10h() + timedelta(days=2 + delta_days))
        code, out = rpc(
            base,
            "remarcar_agendamentos_lote",
            {
                "p_agendamento_id": fixture.ag_ids[1],
                "p_novo_inicio": novo_inicio_lote,
                "p_escopo": "semana",
            },
            jwt,
        )
        assert_true(code < 400, f"lote semana deveria suceder: {code} {out}")
        result = out or {}
        assert_true(result.get("count") == 1, f"count semana esperado 1 (só ag2 ativo), got {result}")

        code, ag2 = rest(base, f"agendamentos?id=eq.{fixture.ag_ids[1]}&select=status")
        assert_true(ag2 and ag2[0]["status"] == "remarcacao", "ag2 deveria estar remarcacao")
        print("OK 5/6 — remarcação em lote (semana) com sucesso")
        passed += 1

        # 6) Rollback forçado no 2º insert — recria par de agendamentos ativos
        cleanup(base, fixture)
        fixture = create_fixture(base)
        setup_trigger()
        set_fail_flag(True)
        before = snapshot(base, fixture)

        code, out = rpc(
            base,
            "remarcar_agendamentos_lote",
            {
                "p_agendamento_id": fixture.ag_ids[0],
                "p_novo_inicio": iso_inicio(next_monday_10h() + timedelta(days=7)),
                "p_escopo": "semana",
            },
            jwt,
        )
        assert_true(code >= 400, f"rollback forçado deveria falhar: {out}")
        msg = json.dumps(out, ensure_ascii=False)
        assert_true(
            "CBMOVE_TEST_FORCED_REMARCAR_FAIL" in msg or "forced" in msg.lower() or code >= 400,
            f"mensagem de falha inesperada: {out}",
        )

        after = snapshot(base, fixture)
        assert_snapshot_unchanged(before, after, "rollback forçado (trigger 2º insert)")
        print("OK 6/6 — rollback forçado manteve dados intactos")
        passed += 1

        set_fail_flag(False)
        print(f"\nTodos os {passed} testes passaram.")
    finally:
        if not keep_data:
            cleanup(base, fixture)


def main() -> int:
    parser = argparse.ArgumentParser(description="Teste integração remarcar_agendamentos_lote")
    parser.add_argument("--keep-data", action="store_true", help="Não apagar dados/trigger de teste ao final")
    args = parser.parse_args()

    load_app_env()
    base = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    if not base.startswith("http"):
        print("SUPABASE_URL ausente", file=sys.stderr)
        return 1
    if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        print("SUPABASE_SERVICE_ROLE_KEY ausente em .env.app", file=sys.stderr)
        return 1

    try:
        run_tests(base, args.keep_data)
        return 0
    except Exception as e:
        print(f"FALHA: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
