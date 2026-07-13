#!/usr/bin/env python3
"""Teste E2E: criar NF pendente e emitir via emit-nf (Focus homologação)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid

from load_app_env import load_app_env

PACIENTE_NOME = "Amanda Pavan"
VALOR_TESTE = 150.0
COMP_MES = 4
COMP_ANO = 2026


def req(method: str, url: str, headers: dict, body: dict | None = None) -> tuple[int, dict | str]:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as res:
            raw = res.read().decode()
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
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def get_user_jwt(base: str, email: str) -> str:
    """Gera sessão admin via magic link (sem e-mail real)."""
    h = admin_headers()
    code, data = req(
        "POST",
        f"{base}/auth/v1/admin/generate_link",
        h,
        {"type": "magiclink", "email": email},
    )
    if code >= 400:
        raise RuntimeError(f"generate_link falhou ({code}): {data}")

    props = data.get("properties") or data
    token_hash = props.get("hashed_token") or props.get("token_hash")
    if not token_hash:
        raise RuntimeError(f"generate_link sem token: {data}")

    anon = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not anon:
        raise RuntimeError("Defina VITE_SUPABASE_PUBLISHABLE_KEY no .env")

    vh = {"apikey": anon, "Content-Type": "application/json"}
    code2, sess = req(
        "POST",
        f"{base}/auth/v1/verify",
        vh,
        {"type": "magiclink", "token_hash": token_hash},
    )
    if code2 >= 400:
        raise RuntimeError(f"verify falhou ({code2}): {sess}")

    token = sess.get("access_token")
    if not token:
        raise RuntimeError(f"verify sem access_token: {sess}")
    return token


def main() -> None:
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    h = admin_headers()

    # 1) Paciente com CPF
    code, rows = req(
        "GET",
        f"{base}/rest/v1/pacientes?select=id,nome,cpf,tipo&nome=eq.{urllib.parse.quote(PACIENTE_NOME)}&limit=1",
        h,
    )
    if code >= 400 or not rows:
        print(f"Paciente não encontrado ({code}): {rows}", file=sys.stderr)
        sys.exit(1)
    paciente = rows[0]
    print(f"Paciente: {paciente['nome']} | CPF: {paciente['cpf']}")

    cpf_digits = "".join(c for c in (paciente["cpf"] or "") if c.isdigit())
    if len(cpf_digits) != 11:
        print("Paciente sem CPF válido.", file=sys.stderr)
        sys.exit(1)

    # 2) Criar NF pendente
    nf_id = str(uuid.uuid4())
    payload = {
        "id": nf_id,
        "paciente_id": paciente["id"],
        "tipo": paciente.get("tipo") or "particular",
        "destinatario_nome": paciente["nome"],
        "destinatario_documento": cpf_digits,
        "corpo_paciente_nome": paciente["nome"],
        "corpo_paciente_cpf": paciente["cpf"],
        "corpo_total_sessoes": 9,
        "corpo_dias_atendidos": "02, 06, 09, 13, 16, 20, 23, 27 E 30",
        "valor": VALOR_TESTE,
        "competencia_mes": COMP_MES,
        "competencia_ano": COMP_ANO,
        "status": "pendente",
    }
    code, created = req("POST", f"{base}/rest/v1/notas_fiscais", {**h, "Prefer": "return=representation"}, payload)
    if code >= 400:
        print(f"Falha ao criar NF ({code}): {created}", file=sys.stderr)
        sys.exit(1)
    print(f"NF pendente criada: {nf_id}")

    # 3) JWT de usuário financeiro
    code, users = req(
        "GET",
        f"{base}/auth/v1/admin/users?page=1&per_page=5",
        h,
    )
    admin_email = None
    for u in users.get("users", []):
        uid = u["id"]
        code_r, roles = req("GET", f"{base}/rest/v1/user_roles?user_id=eq.{uid}&select=role", h)
        if code_r < 400 and any(r["role"] in ("admin", "gestao", "recepcao") for r in roles):
            admin_email = u["email"]
            break
    if not admin_email:
        print("Nenhum usuário com role financeira encontrado.", file=sys.stderr)
        sys.exit(1)
    print(f"Usuário teste: {admin_email}")

    jwt = get_user_jwt(base, admin_email)
    anon = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    # 4) Chamar emit-nf
    print("Chamando emit-nf (homologação Focus)...")
    fn_headers = {
        "apikey": anon,
        "Authorization": f"Bearer {jwt}",
        "Content-Type": "application/json",
    }
    code, result = req(
        "POST",
        f"{base}/functions/v1/emit-nf",
        fn_headers,
        {"nf_id": nf_id, "modo": "automatico"},
    )

    print(f"\n=== Resultado emit-nf (HTTP {code}) ===")
    print(json.dumps(result, ensure_ascii=False, indent=2) if isinstance(result, dict) else result)

    if code >= 400:
        sys.exit(1)

    # 5) Conferir NF no banco
    code, nf = req(
        "GET",
        f"{base}/rest/v1/notas_fiscais?select=id,status,numero,pdf_url,fiscal_provider,emitida_em&id=eq.{nf_id}",
        h,
    )
    if code < 400 and nf:
        print("\n=== NF no banco ===")
        print(json.dumps(nf[0], ensure_ascii=False, indent=2))

    ok = (
        isinstance(result, dict)
        and result.get("ok")
        and result.get("status") == "processando"
        and result.get("focus_status") == "processando_autorizacao"
        and nf
        and nf[0].get("status") == "processando"
    )
    if ok:
        print("\nOK: DPS enviado — status processando (aguardar webhook Focus).")
    else:
        print("\nFALHA: Teste incompleto — verifique resultado acima.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    import urllib.parse  # noqa: E402

    main()
