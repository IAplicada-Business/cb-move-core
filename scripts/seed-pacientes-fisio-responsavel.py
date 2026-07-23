#!/usr/bin/env python3
"""Vincula pacientes às listas Camila/Daniele/Gabriel (fisio responsável).

Dry-run por padrão — gera CSV em scripts/out/seed-fisio-responsavel.csv.
Use --apply para PATCH em pacientes.fisioterapeuta_id.

Uso:
  python scripts/seed-pacientes-fisio-responsavel.py
  python scripts/seed-pacientes-fisio-responsavel.py --apply
"""
from __future__ import annotations

import csv
import difflib
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
APPLY = "--apply" in sys.argv
OUT_DIR = ROOT / "scripts" / "out"

FISIO_DB_NAME: dict[str, str] = {
    "Camila": "Camila Aguiar Pereira",
    "Daniele": "Daniele Martins Moraes",
    "Gabriel": "Gabriel Romagna da Costa",
}

LISTS: dict[str, list[str]] = {
    "Camila": [
        "Airton Tonelo",
        "Alexandre Pires Beiser",
        "Alzira Miller Scherer",
        "Amanda Pavan",
        "Ana Maria Preis",
        "Arthur Borba Tavares",
        "Arthur Flores Gressler",
        "Claudia Gil Barella",
        "Cristina Aparecida dos Santos",
        "Eneida Holmer Fiori",
        "Erna Jeane Altmayer de Lucena",
        "Fabio Martins de Oliveira",
        "Fabio Medeiros de Carvalho",
        "Flavio Adalberto Heineck",
        "Joaquim de Oliveira Borges",
        "Jose Augusto Amorin",
        "Julia Zuchetti Calvi",
        "Karen Castellano",
        "Marcos Antonio de Souza",
        "Marco Aurelio Wendel",
        "Micaela Mutto",
        "Miguel Caminha Sacco",
        "Pedro Haute",
        "Rafael Silveira",
        "Ricardo Araujo Costa",
        "Tania Duarte",
        "Terezinha Vaz",
        "Tsutomu Amakawa",
        "Vilson Duarte",
    ],
    "Daniele": [
        "Amelia Zanetti",
        "Ana Tavares",
        "Andre Domingues",
        "Antonio Carlos Moreira",
        "Cleonice Coelho",
        "Dilso Domingues",
        "Douglas Lara",
        "Elizabete Alves de Souza",
        "Eunice de Oliveira",
        "Everton Arruda",
        "Fabiana Leal",
        "Glaucia Bittencourt",
        "Helena Bom",
        "Ildina Muller",
        "Jose Norberto Lara",
        "Kayhan Bustamante",
        "Larissa Dalla Libera",
        "Livia Morssolin",
        "Lizette Moreira Gadret",
        "Luciana Mancuso Firmbach",
        "Luiza Goncalves dos Santos",
        "Magda Brito",
        "Maria Jose Martins Vital",
        "Mariana Alves Ribeiro",
        "Melissa Castro do Rio",
        "Nilciane Dermoni Lobato",
        "Paulo Clave",
        "Paulo Roberto Magalhaes",
        "Roger Marques",
    ],
    "Gabriel": [
        "Attico Inacio Chassot",
        "Cleidi Elsner Rodrigues",
        "Cristina Helwig Gross Gernhardt",
        "Diego Pereira Agnes",
        "Edemar Streck",
        "Eduardo Dutra Rosa",
        "Eraldo Luiz Perin",
        "Fernando Gomes Dull",
        "Gilson Wagner de Oliveira Alves",
        "Giovani Facchin",
        "Gusthawo Henrique Serrano",
        "Joao Magdalena",
        "Leila Terezinha Ferreira",
        "Luciana da Silva Machado",
        "Luiz Rogerio Braga Schwantz",
        "Maicon Godinho de Oliveira",
        "Majani Vanuza Chagas",
        "Manoel Ezequiel Saldanha",
        "Marcelo Halmenschlager",
        "Paula Suzana Hoffmann Vasques",
        "Paulo Roberto dos Santos Junior",
        "Paulo Rogerio Luz",
        "Renato Rech",
        "Renato Veiga",
        "Roberto Antonio Tomacheski",
        "Ronaldo dos Santos Rocha",
        "Rosemeri Steffani de Quadros",
        "Samir Martins Arrage",
        "Suzana Teixeira Escobar",
    ],
}

# Nome na lista do cliente -> substring única no nome do Supabase (validado em 21/07/2026)
ALIASES: dict[str, str] = {
    "Jose Augusto Amorin": "José Augusto Alves Amorim",
    "Karen Castellano": "Karen Martins Silva Castellano",
    "Micaela Mutto": "Micaela Figueiredo da Silva Mutto",
    "Pedro Haute": "Pedro Augusto de Carvalho Haute",
    "Rafael Silveira": "Rafael Campos Campos da Silveira",
    "Tania Duarte": "TÂNIA MARKIEJCZUK DUARTE",
    "Terezinha Vaz": "Teresinha Rodrigues Vaz",
    "Vilson Duarte": "VILSON FONTOURA DUARTE",
    "Amelia Zanetti": "Amélia Cecília Pereira Zanetti",
    "Andre Domingues": "André Mailander Domingues",
    "Cleonice Coelho": "Cleonice da Costa Coelho",
    "Douglas Lara": "Douglas Gomes Lara",
    "Eunice de Oliveira": "Eunice Guimarães de Oliveira",
    "Everton Arruda": "Éverton Luiz Arruda Sallin",
    "Jose Norberto Lara": "José Norberto Cardoso Lara",
    "Paulo Roberto Magalhaes": "Paulo Roberto Peixoto de Magalhães",
    "Roger Marques": "Roger Souza Marques",
    "Edemar Streck": "Edemar Valdir Streck",
    "Gusthawo Henrique Serrano": "Gusthawo Henrique Bitencourt Serrano",
    "Joao Magdalena": "João Antônio Magdalena",
    "Leila Terezinha Ferreira": "Leila Teresinha Fagundes Ferreira",
    "Paulo Rogerio Luz": "Paulo Rogério Santos da Luz",
    "Ricardo Araujo Costa": "Ricardo Luiz Araújo da Costa",
    "Marco Aurelio Wendel": "Marco Aurélio Wandel",
    "Eneida Holmer Fiori": "Eneida Holmer Fiore",
    "Renato Veiga": "Renato Rech",
    "Fabiana Leal": "Fabiana",
    "Paulo Clave": "Paulo Clavé",
    "Kayhan Bustamante": "Kayhan",
    "Helena Bom": "Helena",
    "Ildina Muller": "Ildina",
}

PENDENTES_MANUAL = {
    "Ana Tavares",
    "Attico Inacio Chassot",
    "Giovani Facchin",
}


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
    s = re.sub(r"[^a-z0-9 ]+", " ", s.lower())
    return " ".join(s.split())


def get_json(url: str, key: str, path: str) -> list:
    rows: list = []
    offset = 0
    page = 1000
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    while True:
        req = urllib.request.Request(
            f"{url}/rest/v1/{path}&limit={page}&offset={offset}",
            headers=headers,
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            chunk = json.loads(resp.read())
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return rows


def patch_paciente(url: str, key: str, paciente_id: str, fisio_id: str) -> None:
    data = json.dumps({"fisioterapeuta_id": fisio_id}).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/pacientes?id=eq.{paciente_id}",
        data=data,
        method="PATCH",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    urllib.request.urlopen(req, timeout=60).read()


def resolve_paciente(
    lista_nome: str,
    db_rows: list[tuple[str, str, str]],
    db_by_norm: dict[str, tuple[str, str]],
) -> tuple[str | None, str | None, str, float]:
    """Retorna (paciente_id, db_nome, status, score)."""
    if lista_nome in PENDENTES_MANUAL:
        return None, None, "pendente_manual", 0.0

    n = norm(lista_nome)
    if n in db_by_norm:
        pid, nome = db_by_norm[n]
        return pid, nome, "exato", 1.0

    alias = ALIASES.get(lista_nome)
    if alias:
        an = norm(alias)
        for pid, dbname, dn in db_rows:
            if an in dn or dn in an or difflib.SequenceMatcher(None, an, dn).ratio() >= 0.88:
                return pid, dbname, "alias", 1.0

    best = None
    best_score = 0.0
    for pid, dbname, dn in db_rows:
        score = difflib.SequenceMatcher(None, n, dn).ratio()
        if score > best_score:
            best_score = score
            best = (pid, dbname)

    if best and best_score >= 0.82:
        return best[0], best[1], "fuzzy", best_score

    if best and best_score >= 0.75:
        return best[0], best[1], "revisar", best_score

    return None, best[1] if best else None, "nao_encontrado", best_score


def main() -> int:
    url, key = load_env()
    pacientes = get_json(
        url,
        key,
        "pacientes?select=id,nome,ativo,fisioterapeuta_id&ativo=eq.true&order=nome",
    )
    fisios = get_json(url, key, "fisioterapeutas?select=id,nome,ativo&ativo=eq.true")

    fisio_id_by_lista: dict[str, str | None] = {}
    for lista, db_name in FISIO_DB_NAME.items():
        hit = next((f for f in fisios if norm(f.get("nome") or "") == norm(db_name)), None)
        fisio_id_by_lista[lista] = hit["id"] if hit else None
        if not hit:
            print(f"AVISO: fisio '{db_name}' não encontrado no DB", file=sys.stderr)

    db_rows = [(p["id"], p["nome"], norm(p["nome"])) for p in pacientes]
    db_by_norm = {dn: (pid, nome) for pid, nome, dn in db_rows}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    csv_path = OUT_DIR / f"seed-fisio-responsavel-{ts}.csv"

    rows_out: list[dict] = []
    aplicados = 0
    stats: dict[str, int] = {}

    for lista_fisio, nomes in LISTS.items():
        fisio_id = fisio_id_by_lista.get(lista_fisio)
        for lista_nome in nomes:
            pid, db_nome, status, score = resolve_paciente(lista_nome, db_rows, db_by_norm)
            stats[status] = stats.get(status, 0) + 1

            acao = "skip"
            if pid and fisio_id and status in ("exato", "alias", "fuzzy"):
                acao = "aplicar" if APPLY else "dry_run"
                if APPLY:
                    try:
                        patch_paciente(url, key, pid, fisio_id)
                        aplicados += 1
                    except urllib.error.HTTPError as e:
                        acao = f"erro:{e.code}"
            elif status == "revisar":
                acao = "revisar_antes_aplicar"

            rows_out.append(
                {
                    "lista_fisio": lista_fisio,
                    "nome_lista": lista_nome,
                    "nome_db": db_nome or "",
                    "paciente_id": pid or "",
                    "fisio_id": fisio_id or "",
                    "status": status,
                    "score": f"{score:.2f}",
                    "acao": acao,
                }
            )

    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "lista_fisio",
                "nome_lista",
                "nome_db",
                "paciente_id",
                "fisio_id",
                "status",
                "score",
                "acao",
            ],
        )
        w.writeheader()
        w.writerows(rows_out)

    total = sum(len(v) for v in LISTS.values())
    print(f"Modo: {'APPLY' if APPLY else 'DRY-RUN'}")
    print(f"Total lista: {total}")
    print(f"CSV: {csv_path}")
    for k in sorted(stats):
        print(f"  {k}: {stats[k]}")
    if APPLY:
        print(f"PATCH aplicados: {aplicados}")
    else:
        print("Execute com --apply após revisar o CSV.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
