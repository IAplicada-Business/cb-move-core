"""Extrai CPF dos documentos do Drive e atualiza pacientes no Supabase."""
from __future__ import annotations

import io
import json
import os
import re
import subprocess
import unicodedata
from pathlib import Path

from docx import Document
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
IMPORT_DIR = ROOT / "drive_import"
REPORT = ROOT / "cpf_import_report.json"

CPF_RE = re.compile(r"\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b")


def norm_cpf(raw: str) -> str | None:
    d = re.sub(r"\D", "", raw)
    if len(d) != 11:
        return None
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"


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
    name = re.sub(r"\s*\([^)]*\)\s*", " ", name).strip()
    name = re.sub(r"[^A-Z0-9\s\.\-']", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def extract_pairs_from_text(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    patterns = [
        r"PRESTADAS?\s+(?:À|AO|A)\s+(?:SRTA\.?|SRA\.?|SR\.?)?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s\.\-']{4,}?)\s*,\s*CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        r"PRESTADAS?\s+(?:À|AO|A)\s+(?:SRTA\.?|SRA\.?|SR\.?)?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s\.\-']{4,}?)\s+CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        r"ESPECIALIZADA\s+DE\s+([A-ZÀ-Ú][A-ZÀ-Ú\s\.\-']{4,}?)\s*,\s*CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        r"([A-ZÀ-Ú][A-ZÀ-Ú\s\.\-']{4,}?)\s*,\s*CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        r"SR\s+([A-ZÀ-Ú][A-ZÀ-Ú\s\.\-']{4,}?)\s*,\s*CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
    ]
    upper = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").upper()

    for pat in patterns:
        for m in re.finditer(pat, upper, re.I):
            name = norm_name(m.group(1))
            cpf = norm_cpf(m.group(2))
            if not name or not cpf:
                continue
            if len(name.split()) < 2:
                continue
            if any(x in name for x in ("EMITENTE", "FISIOTERAPEUT", "CREFITO", "CONVENIO", "BRADESCO", "UNIMED")):
                continue
            out.setdefault(name, cpf)

    return out


def extract_tomador_from_nf_pdf(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    idx = text.upper().find("TOMADOR DO SERVI")
    if idx < 0:
        return out
    end = text.upper().find("SERVI", idx + 10)
    end = text.upper().find("SERVIÇO PRESTADO", idx)
    if end < 0:
        end = text.upper().find("SERVICO PRESTADO", idx)
    block = text[idx : end if end > idx else idx + 1200]
    cpf_m = re.search(
        r"CNPJ\s*/\s*CPF\s*/\s*NIF\s*\n\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        block,
        re.I,
    )
    name_m = re.search(r"Nome\s*/\s*Nome Empresarial\s*\n\s*(.+?)\n", block, re.I)
    if not name_m or not cpf_m:
        return out
    name = norm_name(name_m.group(1))
    cpf = norm_cpf(cpf_m.group(1))
    if name and cpf and len(name.split()) >= 2:
        out[name] = cpf
    return out


def extract_from_docx(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    text = "\n".join(p.text for p in Document(path).paragraphs if p.text.strip())
    return extract_pairs_from_text(text)


def extract_all() -> dict[str, str]:
    merged: dict[str, str] = {}

    for doc_name in ("doc2.docx", "texto_padrao_nf.docx"):
        merged.update(extract_from_docx(IMPORT_DIR / doc_name))

    pdf_paths = sorted(IMPORT_DIR.glob("nf_*.pdf")) + sorted(IMPORT_DIR.glob("file*.bin"))
    for path in pdf_paths:
        raw = path.read_bytes()
        if raw[:4] != b"%PDF":
            continue
        reader = PdfReader(io.BytesIO(raw))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
        merged.update(extract_tomador_from_nf_pdf(text))
        desc = ""
        m = re.search(r"Descri[cç][aã]o do Servi[cç]o\s*(.+?)\s*TRIBUTA", text, re.I | re.S)
        if m:
            desc = m.group(1)
        else:
            desc = text
        merged.update(extract_pairs_from_text(desc))

    return merged


def fetch_pacientes() -> list[dict]:
    proc = subprocess.run(
        [
            "supabase",
            "db",
            "query",
            "--linked",
            "SELECT id, nome, cpf, tipo FROM pacientes ORDER BY nome;",
        ],
        cwd=r"D:\IAPLICADA\CBmove",
        capture_output=True,
        text=True,
        shell=True,
        env={**os.environ},
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    data = json.loads(proc.stdout)
    return data["rows"]


def score_match(paciente_nome: str, extracted_name: str) -> float:
    p = set(norm_name(paciente_nome).split())
    e = set(extracted_name.split())
    if not p or not e:
        return 0.0
    inter = len(p & e)
    return inter / max(len(p), len(e))


def match_pairs(pacientes: list[dict], pairs: dict[str, str]) -> list[dict]:
    updates = []
    unmatched_pairs = dict(pairs)

    for p in pacientes:
        if p.get("cpf") and str(p["cpf"]).strip():
            continue
        best_name = None
        best_score = 0.0
        for ext_name, cpf in pairs.items():
            s = score_match(p["nome"], ext_name)
            if s > best_score:
                best_score = s
                best_name = ext_name
        if best_name and best_score >= 0.6:
            updates.append(
                {
                    "id": p["id"],
                    "nome": p["nome"],
                    "cpf": pairs[best_name],
                    "matched_from": best_name,
                    "score": round(best_score, 2),
                }
            )
            unmatched_pairs.pop(best_name, None)

    return updates, unmatched_pairs


def apply_updates(updates: list[dict]) -> None:
    if not updates:
        return
    values = ",\n".join(
        f"('{u['id']}'::uuid, '{u['cpf'].replace(chr(39), chr(39)*2)}')"
        for u in updates
    )
    sql = f"""WITH data(id, cpf) AS (
  VALUES
  {values}
)
UPDATE pacientes p
SET cpf = d.cpf
FROM data d
WHERE p.id = d.id
  AND (p.cpf IS NULL OR btrim(p.cpf) = '');

SELECT count(*)::int AS com_cpf FROM pacientes WHERE cpf IS NOT NULL AND btrim(cpf) <> '';
"""
    sql_path = ROOT / "cpf_import_apply.sql"
    sql_path.write_text(sql, encoding="utf-8")
    proc = subprocess.run(
        ["supabase", "db", "query", "--linked", "-f", str(sql_path)],
        cwd=r"D:\IAPLICADA\CBmove",
        capture_output=True,
        text=True,
        shell=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    print(proc.stdout[-800:])


def main() -> None:
    pairs = extract_all()
    print("extracted_pairs", len(pairs))

    pacientes = fetch_pacientes()
    updates, unmatched = match_pairs(pacientes, pairs)
    print("matched_updates", len(updates))
    print("unmatched_pairs", len(unmatched))

    report = {
        "extracted": pairs,
        "updates": updates,
        "unmatched_pairs": unmatched,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    if updates:
        apply_updates(updates)
    for u in updates[:20]:
        print(u["nome"], "->", u["cpf"], f"({u['score']})")


if __name__ == "__main__":
    main()
