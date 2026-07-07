"""Importa PDFs de NFS-e do Drive para notas_fiscais no Supabase."""
from __future__ import annotations

import io
import json
import re
import subprocess
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
IMPORT_DIR = ROOT / "drive_import"
REPORT = ROOT / "nf_import_report.json"
PROJECT = Path(r"D:\IAPLICADA\CBmove")

MONTHS = {
    "JANEIRO": 1,
    "FEVEREIRO": 2,
    "MARCO": 3,
    "MARÇO": 3,
    "ABRIL": 4,
    "MAIO": 5,
    "JUNHO": 6,
    "JULHO": 7,
    "AGOSTO": 8,
    "SETEMBRO": 9,
    "OUTUBRO": 10,
    "NOVEMBRO": 11,
    "DEZEMBRO": 12,
}

DRIVE_IDS = {
    "2185": "1m1SJmhZx4GhyZwp9jCCv6wFnLFjxY-NC",
    "2082": "16CNuUqVx9_qTWrq8M2uQ-osOEbi-L0yE",
    "2085": "1ADN5-xJvN3qRUDEy3R2SRsLfAbJB-spn",
    "2088": "1Fcyr9X9UB_ioabjMdS-nkP8NfYn2oyDR",
    "2135": "1iB2cKpuhR6gYiIHsu5MMH0SzPaoPjLPV",
    "2199": "1hlhsau9zb2S1l4JYVfpSEvuP3J40MZgC",
}

PACIENTE_HINTS = {
    "2185": "kayhan bustamante",
    "2082": "airton tonelo",
    "2085": "amanda pavan",
    "2088": "cleidi elsner",
    "2135": "dilso domingos",
}


def fix_mojibake(name: str) -> str:
    try:
        return name.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return name


def norm_name(name: str) -> str:
    name = fix_mojibake(name)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"\s+", " ", name.upper().strip())
    name = re.sub(r"[^A-Z0-9\s\.\-']", " ", name)
    return re.sub(r"\s+", " ", name).strip()


def parse_money(raw: str) -> float:
    return float(raw.replace(".", "").replace(",", "."))


def parse_date_br(raw: str) -> str:
    d = datetime.strptime(raw.strip(), "%d/%m/%Y")
    return d.strftime("%Y-%m-%d")


@dataclass
class NfParsed:
    source: str
    numero: str
    valor: float
    emissao: str
    competencia_mes: int | None
    competencia_ano: int | None
    destinatario_nome: str
    destinatario_documento: str
    corpo_paciente_nome: str | None
    corpo_paciente_cpf: str | None
    corpo_total_sessoes: int | None
    corpo_numero_processo: str | None
    tipo: str
    paciente_hint: str | None


def parse_pdf(path: Path) -> NfParsed | None:
    raw = path.read_bytes()
    if raw[:4] != b"%PDF":
        return None
    text = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(raw)).pages)

    numero_m = re.search(r"N[uú]mero da NFS-e\s*\n\s*(\d+)", text, re.I)
    emissao_m = re.search(r"Data e Hora da emiss[aã]o da NFS-e\s*\n\s*(\d{2}/\d{2}/\d{4})", text, re.I)
    valor_m = re.search(r"Valor do Servi[cç]o\s*\n\s*R\$\s*([\d\.,]+)", text, re.I)
    sessoes_m = re.search(r"TOTALIZANDO\s+(\d+)\s+SESS", text, re.I)
    comp_m = re.search(r"M[EÊ]S DE\s+(\w+)(?:\s+DE\s+(\d{4}))?", text, re.I)
    processo_m = re.search(r"N[uú]mero do Processo:\s*([\d\.\-]+)", text, re.I)

    if not numero_m or not emissao_m or not valor_m:
        return None

    numero = numero_m.group(1)
    idx = text.upper().find("TOMADOR DO SERVI")
    block = text[idx : idx + 500] if idx >= 0 else ""
    doc_m = re.search(r"CNPJ\s*/\s*CPF\s*/\s*NIF\s*\n\s*([\d\./\-]+)", block, re.I)
    nome_m = re.search(r"Nome\s*/\s*Nome Empresarial\s*\n\s*(.+?)\n", block, re.I)
    dest_doc = (doc_m.group(1) if doc_m else "").strip()
    dest_nome = (nome_m.group(1).strip() if nome_m else "").strip()

    comp_mes = comp_ano = None
    if comp_m:
        comp_mes = MONTHS.get(comp_m.group(1).upper().replace("Ç", "C"))
        comp_ano = int(comp_m.group(2)) if comp_m.group(2) else int(emissao_m.group(1)[-4:])

    corpo_nome = corpo_cpf = None
    if re.fullmatch(r"\d{3}\.\d{3}\.\d{3}-\d{2}", dest_doc):
        corpo_nome = dest_nome
        corpo_cpf = dest_doc
    else:
        desc_m = re.search(r"Descri[cç][aã]o do Servi[cç]o(.{0,2500})TRIBUTA", text, re.I | re.S)
        if desc_m:
            desc = desc_m.group(1)
            if "SEGUINTES PACIENTES" in desc.upper():
                corpo_nome = "Vários pacientes Unimed (abr/2026)"
            else:
                pair = re.search(
                    r"PRESTADAS?\s+(?:À|AO|A)\s+(?:SRTA\.?|SRA\.?|SR\.?)?\s*([A-ZÀ-Ú][^\n,]{4,}?)(?:,|\s+CPF)",
                    desc,
                    re.I,
                )
                if pair:
                    corpo_nome = pair.group(1).strip()

    digits = re.sub(r"\D", "", dest_doc)
    if len(digits) == 11:
        tipo = "particular"
    elif processo_m:
        tipo = "judicial"
    elif len(digits) == 14:
        tipo = "convenio"
    else:
        tipo = "convenio"

    return NfParsed(
        source=path.name,
        numero=numero,
        valor=parse_money(valor_m.group(1)),
        emissao=parse_date_br(emissao_m.group(1)),
        competencia_mes=comp_mes,
        competencia_ano=comp_ano,
        destinatario_nome=dest_nome,
        destinatario_documento=dest_doc,
        corpo_paciente_nome=corpo_nome,
        corpo_paciente_cpf=corpo_cpf,
        corpo_total_sessoes=int(sessoes_m.group(1)) if sessoes_m else None,
        corpo_numero_processo=processo_m.group(1) if processo_m else None,
        tipo=tipo,
        paciente_hint=PACIENTE_HINTS.get(numero),
    )


def db_query(sql: str) -> dict:
    sql = " ".join(sql.split())
    proc = subprocess.run(
        ["supabase", "db", "query", "--linked", sql],
        cwd=str(PROJECT),
        capture_output=True,
        text=True,
        shell=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    return json.loads(proc.stdout)


def fetch_existing_numeros() -> set[str]:
    data = db_query("SELECT numero FROM public.notas_fiscais WHERE numero IS NOT NULL;")
    return {str(r["numero"]) for r in data["rows"]}


def fetch_pacientes() -> list[dict]:
    data = db_query("SELECT id, nome, tipo, cpf FROM public.pacientes ORDER BY nome;")
    return data["rows"]


def fetch_cobrancas(mes: int, ano: int) -> list[dict]:
    data = db_query(
        "SELECT c.id, c.paciente_id, c.valor, c.tipo, c.status "
        f"FROM public.cobrancas c "
        f"WHERE c.competencia_mes = {mes} AND c.competencia_ano = {ano} "
        "AND c.status <> 'cancelado';"
    )
    return data["rows"]


def score_match(a: str, b: str) -> float:
    p = set(norm_name(a).split())
    e = set(norm_name(b).split())
    if not p or not e:
        return 0.0
    return len(p & e) / max(len(p), len(e))


def resolve_paciente(nf: NfParsed, pacientes: list[dict]) -> dict | None:
    if nf.paciente_hint:
        hinted = [p for p in pacientes if score_match(p["nome"], nf.paciente_hint) >= 0.5]
        if len(hinted) == 1:
            return hinted[0]
        if hinted:
            hinted.sort(key=lambda p: score_match(p["nome"], nf.paciente_hint), reverse=True)
            return hinted[0]

    candidates: list[tuple[float, dict]] = []
    for p in pacientes:
        if nf.corpo_paciente_cpf and p.get("cpf"):
            if re.sub(r"\D", "", nf.corpo_paciente_cpf) == re.sub(r"\D", "", str(p["cpf"])):
                return p
        score = score_match(p["nome"], nf.destinatario_nome)
        if nf.corpo_paciente_nome and "Vários" not in nf.corpo_paciente_nome:
            score = max(score, score_match(p["nome"], nf.corpo_paciente_nome))
        if nf.paciente_hint:
            score = max(score, score_match(p["nome"], nf.paciente_hint))
        if score >= 0.6:
            candidates.append((score, p))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def resolve_cobranca(
    paciente_id: str | None, valor: float, mes: int | None, ano: int | None, cobrancas: list[dict]
) -> str | None:
    if not paciente_id or not mes or not ano:
        return None
    matches = [c for c in cobrancas if c["paciente_id"] == paciente_id]
    if not matches:
        return None
    exact = [c for c in matches if abs(float(c["valor"]) - valor) < 0.02]
    if len(exact) == 1:
        return exact[0]["id"]
    if len(matches) == 1:
        return matches[0]["id"]
    return None


def drive_pdf_url(numero: str) -> str | None:
    file_id = DRIVE_IDS.get(numero)
    if not file_id:
        return None
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def build_insert(nf: NfParsed, paciente: dict | None, cobranca_id: str | None) -> str:
    pdf_url = drive_pdf_url(nf.numero)
    paciente_id = paciente["id"] if paciente else None
    tipo = paciente["tipo"] if paciente else nf.tipo
    return f"""(
  {sql_literal(cobranca_id)}::uuid,
  {sql_literal(nf.numero)},
  {nf.valor:.2f},
  'emitida',
  {sql_literal(paciente_id)}::uuid,
  {sql_literal(tipo)}::public.paciente_tipo,
  {sql_literal(nf.destinatario_nome)},
  {sql_literal(nf.destinatario_documento)},
  {sql_literal(nf.corpo_paciente_nome or (paciente['nome'] if paciente else None))},
  {sql_literal(nf.corpo_paciente_cpf or (paciente.get('cpf') if paciente else None))},
  {nf.corpo_total_sessoes if nf.corpo_total_sessoes is not None else 'NULL'},
  {sql_literal(nf.corpo_numero_processo)},
  {sql_literal(nf.emissao)}::date,
  {sql_literal(pdf_url)},
  {nf.competencia_mes if nf.competencia_mes is not None else 'NULL'},
  {nf.competencia_ano if nf.competencia_ano is not None else 'NULL'},
  'drive_import'
)"""


def collect_pdfs() -> list[Path]:
    seen: set[str] = set()
    paths: list[Path] = []
    for pattern in ("nf_*.pdf", "file*.bin"):
        for path in sorted(IMPORT_DIR.glob(pattern)):
            parsed = parse_pdf(path)
            if not parsed or parsed.numero in seen:
                continue
            seen.add(parsed.numero)
            paths.append(path)
    return paths


def main() -> None:
    existing = fetch_existing_numeros()
    pacientes = fetch_pacientes()
    cobrancas_cache: dict[tuple[int, int], list[dict]] = {}

    to_insert: list[dict] = []
    skipped: list[dict] = []

    for path in collect_pdfs():
        nf = parse_pdf(path)
        if not nf:
            skipped.append({"source": path.name, "reason": "parse_failed"})
            continue
        if nf.numero in existing:
            skipped.append({"source": path.name, "numero": nf.numero, "reason": "already_exists"})
            continue

        paciente = resolve_paciente(nf, pacientes)
        cobrancas: list[dict] = []
        if nf.competencia_mes and nf.competencia_ano:
            key = (nf.competencia_mes, nf.competencia_ano)
            if key not in cobrancas_cache:
                cobrancas_cache[key] = fetch_cobrancas(*key)
            cobrancas = cobrancas_cache[key]
        cobranca_id = resolve_cobranca(
            paciente["id"] if paciente else None,
            nf.valor,
            nf.competencia_mes,
            nf.competencia_ano,
            cobrancas,
        )

        to_insert.append(
            {
                "nf": nf,
                "paciente": paciente,
                "cobranca_id": cobranca_id,
                "sql": build_insert(nf, paciente, cobranca_id),
            }
        )

    if not to_insert:
        print("nothing_to_insert", len(skipped))
        REPORT.write_text(json.dumps({"inserted": [], "skipped": skipped}, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    values = ",\n".join(item["sql"] for item in to_insert)
    sql = f"""
INSERT INTO public.notas_fiscais (
  cobranca_id, numero, valor, status,
  paciente_id, tipo,
  destinatario_nome, destinatario_documento,
  corpo_paciente_nome, corpo_paciente_cpf,
  corpo_total_sessoes, corpo_numero_processo,
  emissao, pdf_url,
  competencia_mes, competencia_ano,
  fiscal_provider
)
VALUES
{values}
RETURNING id, numero, paciente_id, valor, status;
"""
    sql_path = ROOT / "nf_import_apply.sql"
    sql_path.write_text(sql, encoding="utf-8")
    proc = subprocess.run(
        ["supabase", "db", "query", "--linked", "-f", str(sql_path)],
        cwd=str(PROJECT),
        capture_output=True,
        text=True,
        shell=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    inserted = json.loads(proc.stdout)

    report = {
        "inserted": [
            {
                "numero": item["nf"].numero,
                "valor": item["nf"].valor,
                "paciente": item["paciente"]["nome"] if item["paciente"] else None,
                "cobranca_id": item["cobranca_id"],
                "source": item["nf"].source,
            }
            for item in to_insert
        ],
        "skipped": skipped,
        "db_result": inserted,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["inserted"], ensure_ascii=False, indent=2))
    print("total_inserted", len(to_insert), "skipped", len(skipped))


if __name__ == "__main__":
    main()
