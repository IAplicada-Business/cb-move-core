#!/usr/bin/env python3
"""Testes complementares da automação NF pós-pagamento Cora (fecha lacunas do E2E inicial):

  1) Segurança: cobranca boleto_modo='manual' com cora_invoice_id NUNCA é tocada.
  2) Kill switch: CORA_AUTO_NF_ENABLED=false marca pago mas NAO cria/dispara NF.
  3) Webhook isolado: chama cora-webhook diretamente (sem depender do polling manual),
     após confirmar que o boleto já liquidou, simulando o ping real da Cora.
  4) Caminho feliz completo: convenio com endereço completo -> NF aceita pela Focus NFe
     (homologação) de verdade (fiscal_provider=focus_nfe, status=processando).

Usa dados sintéticos descartáveis ("TESTE AUTOMACAO CORA EXTRA - APAGAR"), removidos ao final
(a menos que --keep seja passado).

python scripts/test_cora_nf_automatica_extra.py
"""
from __future__ import annotations

import os
import sys
import tempfile
import time
import uuid
from datetime import date
from pathlib import Path

import requests

from load_app_env import load_app_env

PROJECT_REF = "grlkbtnwvxorlfglyzid"
TEST_CPF = "11144477735"
TEST_LABEL = "TESTE AUTOMACAO CORA EXTRA - APAGAR"

created = {"pacientes": [], "cobrancas": [], "convenios": []}


def cnpj_check_digits(base12: str) -> str:
    assert len(base12) == 12, f"base12 precisa ter 12 dígitos, recebeu {len(base12)}: {base12}"

    def calc(digits, weights):
        total = sum(int(d) * w for d, w in zip(digits, weights))
        rest = total % 11
        return "0" if rest < 2 else str(11 - rest)

    d1 = calc(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    d2 = calc(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return base12 + d1 + d2


def rest(base, key, method, path, **kwargs):
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    headers.update(kwargs.pop("headers", {}))
    res = requests.request(method, f"{base}/rest/v1/{path}", headers=headers, timeout=30, **kwargs)
    res.raise_for_status()
    return res.json() if res.text else None


def get_config(base, key, chave):
    rows = rest(base, key, "GET", "integracao_config", params={"select": "valor", "chave": f"eq.{chave}"})
    return rows[0]["valor"] if rows else None


def set_config(base, key, chave, valor):
    rest(base, key, "POST", f"integracao_config?on_conflict=chave", headers={"Prefer": "resolution=merge-duplicates"}, json=[{"chave": chave, "valor": valor}])


def mtls_cert(certificate, private_key, tmpdir):
    cert_path = Path(tmpdir) / "cert.pem"
    key_path = Path(tmpdir) / "key.pem"
    cert_path.write_text(certificate.replace("\\n", "\n").strip() + "\n", encoding="utf-8")
    key_path.write_text(private_key.replace("\\n", "\n").strip() + "\n", encoding="utf-8")
    return (str(cert_path), str(key_path))


def get_token(api_base, cert, client_id):
    res = requests.post(
        f"{api_base}/token", data={"grant_type": "client_credentials", "client_id": client_id},
        headers={"Content-Type": "application/x-www-form-urlencoded"}, cert=cert, timeout=30,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def create_and_pay_invoice(api_base, cert, token, code, valor_centavos=500):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "code": code,
        "customer": {"name": TEST_LABEL, "email": "teste-automacao-cora@cbmove.com.br", "document": {"identity": TEST_CPF, "type": "CPF"}},
        "services": [{"name": "Teste automação Cora", "description": "Teste extra", "amount": valor_centavos}],
        "payment_terms": {"due_date": date.today().isoformat()},
    }
    create_res = requests.post(f"{api_base}/v2/invoices", json=payload, headers={**headers, "Idempotency-Key": str(uuid.uuid4())}, cert=cert, timeout=30)
    create_res.raise_for_status()
    invoice_id = create_res.json()["id"]
    pay_res = requests.post(f"{api_base}/v2/invoices/pay", json={"id": invoice_id}, headers={**headers, "Idempotency-Key": str(uuid.uuid4())}, cert=cert, timeout=30)
    pay_res.raise_for_status()
    return invoice_id


def wait_paid(api_base, cert, token, invoice_id, tries=10, wait_s=8):
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(tries):
        res = requests.get(f"{api_base}/v2/invoices/{invoice_id}", headers=headers, cert=cert, timeout=30)
        res.raise_for_status()
        if res.json().get("status") == "PAID":
            return True
        time.sleep(wait_s)
    return False


def create_cobranca(base, key, suffix, tipo="particular", boleto_modo="automatico", valor=5.00, convenio_id=None):
    paciente = rest(base, key, "POST", "pacientes", headers={"Prefer": "return=representation"}, json={
        "nome": f"{TEST_LABEL} {suffix}", "cpf": TEST_CPF, "email": "teste-automacao-cora@cbmove.com.br",
        "tipo": tipo, "convenio_id": convenio_id,
    })[0]
    created["pacientes"].append(paciente["id"])
    cobranca = rest(base, key, "POST", "cobrancas", headers={"Prefer": "return=representation"}, json={
        "paciente_id": paciente["id"], "descricao": f"{TEST_LABEL} {suffix}", "valor": valor, "tipo": tipo,
        "status": "pendente", "vencimento": date.today().isoformat(),
        "competencia_mes": date.today().month, "competencia_ano": date.today().year,
        "servico": "Teste automação Cora", "boleto_modo": boleto_modo,
    })[0]
    created["cobrancas"].append(cobranca["id"])
    return paciente, cobranca


def cleanup(base, key, keep):
    if keep:
        print("\n--keep informado: dados de teste NAO removidos.")
        print(created)
        return
    print("\n== Limpando dados de teste ==")
    for cob_id in created["cobrancas"]:
        rest(base, key, "DELETE", f"cobrancas_pagamentos_eventos?cobranca_id=eq.{cob_id}")
        rest(base, key, "DELETE", f"notas_fiscais?cobranca_id=eq.{cob_id}")
        rest(base, key, "DELETE", f"cobrancas?id=eq.{cob_id}")
    for pac_id in created["pacientes"]:
        rest(base, key, "DELETE", f"pacientes?id=eq.{pac_id}")
    for conv_id in created["convenios"]:
        rest(base, key, "DELETE", f"convenios?id=eq.{conv_id}")
    print("OK — dados de teste removidos.")


def run_polling(base, cron_secret):
    res = requests.post(f"{base}/functions/v1/cora-verificar-pagamentos", headers={"x-cron-secret": cron_secret}, timeout=60)
    return res.status_code, res.json()


def main():
    keep = "--keep" in sys.argv
    load_app_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    client_id = get_config(base, key, "CORA_CLIENT_ID")
    certificate = get_config(base, key, "CORA_CERTIFICATE")
    private_key = get_config(base, key, "CORA_PRIVATE_KEY")
    api_base = get_config(base, key, "CORA_API_BASE") or "https://matls-clients.api.stage.cora.com.br"
    cron_secret = get_config(base, key, "CRON_SECRET")
    webhook_secret = get_config(base, key, "CORA_WEBHOOK_SHARED_SECRET")

    with tempfile.TemporaryDirectory() as tmpdir:
        cert = mtls_cert(certificate, private_key, tmpdir)
        token = get_token(api_base, cert, client_id)

        results = {}

        # === Teste 1: boleto_modo='manual' nunca é tocado ===
        print("\n########## TESTE 1: boleto_modo='manual' — segurança ##########")
        _, cob1 = create_cobranca(base, key, "(manual-safety)", boleto_modo="manual")
        inv1 = create_and_pay_invoice(api_base, cert, token, cob1["id"])
        rest(base, key, "PATCH", f"cobrancas?id=eq.{cob1['id']}", json={"cora_invoice_id": inv1, "boleto_modo": "manual"})
        wait_paid(api_base, cert, token, inv1, tries=6, wait_s=5)
        status_code, body = run_polling(base, cron_secret)
        cob1_after = rest(base, key, "GET", "cobrancas", params={"select": "status,boleto_modo", "id": f"eq.{cob1['id']}"})[0]
        touched = any(r["cobranca_id"] == cob1["id"] for r in body.get("resultados", []))
        results["teste1_manual_nao_tocada"] = (cob1_after["status"] == "pendente") and not touched
        print(f"cobranca.status={cob1_after['status']} (esperado: pendente) | apareceu na varredura={touched} (esperado: False)")
        print(f"RESULTADO: {'PASSOU' if results['teste1_manual_nao_tocada'] else 'FALHOU'}")

        # === Teste 2: kill switch CORA_AUTO_NF_ENABLED=false ===
        print("\n########## TESTE 2: kill switch CORA_AUTO_NF_ENABLED=false ##########")
        set_config(base, key, "CORA_AUTO_NF_ENABLED", "false")
        _, cob2 = create_cobranca(base, key, "(kill-switch)")
        inv2 = create_and_pay_invoice(api_base, cert, token, cob2["id"])
        rest(base, key, "PATCH", f"cobrancas?id=eq.{cob2['id']}", json={"cora_invoice_id": inv2, "boleto_modo": "automatico"})
        wait_paid(api_base, cert, token, inv2, tries=6, wait_s=5)
        status_code, body = run_polling(base, cron_secret)
        cob2_after = rest(base, key, "GET", "cobrancas", params={"select": "status", "id": f"eq.{cob2['id']}"})[0]
        nfs2 = rest(base, key, "GET", "notas_fiscais", params={"select": "id", "cobranca_id": f"eq.{cob2['id']}"})
        set_config(base, key, "CORA_AUTO_NF_ENABLED", "true")
        results["teste2_kill_switch"] = (cob2_after["status"] == "pago") and (len(nfs2) == 0)
        print(f"cobranca.status={cob2_after['status']} (esperado: pago) | notas_fiscais criadas={len(nfs2)} (esperado: 0)")
        print(f"RESULTADO: {'PASSOU' if results['teste2_kill_switch'] else 'FALHOU'}")

        # === Teste 3: webhook isolado (sem polling) ===
        print("\n########## TESTE 3: webhook isolado (chamada direta a cora-webhook) ##########")
        _, cob3 = create_cobranca(base, key, "(webhook-isolado)")
        inv3 = create_and_pay_invoice(api_base, cert, token, cob3["id"])
        rest(base, key, "PATCH", f"cobrancas?id=eq.{cob3['id']}", json={"cora_invoice_id": inv3, "boleto_modo": "automatico"})
        paid = wait_paid(api_base, cert, token, inv3, tries=10, wait_s=8)
        print(f"invoice liquidado antes do webhook simulado: {paid}")
        webhook_res = requests.post(
            f"{base}/functions/v1/cora-webhook?secret={webhook_secret}",
            headers={
                "webhook-event-id": f"evt_teste_{uuid.uuid4().hex[:16]}",
                "webhook-event-type": "invoice.paid",
                "webhook-resource-id": inv3,
                "content-length": "0",
            },
            timeout=60,
        )
        cob3_after = rest(base, key, "GET", "cobrancas", params={"select": "status", "id": f"eq.{cob3['id']}"})[0]
        nfs3 = rest(base, key, "GET", "notas_fiscais", params={"select": "id,status", "cobranca_id": f"eq.{cob3['id']}"})
        eventos3 = rest(base, key, "GET", "cobrancas_pagamentos_eventos", params={"select": "erro,emit_nf_disparado", "cobranca_id": f"eq.{cob3['id']}"})
        results["teste3_webhook_isolado"] = paid and (cob3_after["status"] == "pago") and (len(nfs3) == 1)
        print(f"webhook status={webhook_res.status_code} body={webhook_res.text}")
        print(f"cobranca.status={cob3_after['status']} (esperado: pago) | notas_fiscais={len(nfs3)} (esperado: 1) | eventos={eventos3}")
        print(f"RESULTADO: {'PASSOU' if results['teste3_webhook_isolado'] else 'FALHOU'}")

        # === Teste 4: caminho feliz — convenio com endereço completo ===
        print("\n########## TESTE 4: NF aceita pela Focus (convenio com endereço completo) ##########")
        cnpj = cnpj_check_digits("112223330001")
        convenio = rest(base, key, "POST", "convenios", headers={"Prefer": "return=representation"}, json={
            "nome": f"{TEST_LABEL} Convenio", "cnpj": cnpj, "razao_social": f"{TEST_LABEL} CONVENIO LTDA",
            "email_nf": "teste-automacao-cora@cbmove.com.br",
            "endereco": "R Teste Automacao", "numero": "123", "bairro": "Centro", "cep": "90010000", "cidade": "Porto Alegre", "uf": "RS",
            "codigo_municipio_ibge": 4314902, "ativo": True,
        })[0]
        created["convenios"].append(convenio["id"])
        _, cob4 = create_cobranca(base, key, "(nf-happy-path)", tipo="convenio", convenio_id=convenio["id"])
        inv4 = create_and_pay_invoice(api_base, cert, token, cob4["id"])
        rest(base, key, "PATCH", f"cobrancas?id=eq.{cob4['id']}", json={"cora_invoice_id": inv4, "boleto_modo": "automatico"})
        wait_paid(api_base, cert, token, inv4, tries=10, wait_s=8)
        status_code, body = run_polling(base, cron_secret)
        resultado4 = next((r for r in body.get("resultados", []) if r["cobranca_id"] == cob4["id"]), None)
        nfs4 = rest(base, key, "GET", "notas_fiscais", params={"select": "*", "cobranca_id": f"eq.{cob4['id']}"})
        nf4_status = nfs4[0]["status"] if nfs4 else None
        results["teste4_nf_happy_path"] = bool(resultado4 and resultado4.get("marcou_pago") and resultado4.get("emit_nf_disparado") and nf4_status == "processando")
        print(f"resultado do sync: {resultado4}")
        print(f"NF status={nf4_status} (esperado: processando)")
        print(f"RESULTADO: {'PASSOU' if results['teste4_nf_happy_path'] else 'FALHOU'}")

        print("\n########## RESUMO ##########")
        for k, v in results.items():
            print(f"{k}: {'PASSOU' if v else 'FALHOU'}")

        cleanup(base, key, keep)


if __name__ == "__main__":
    main()
