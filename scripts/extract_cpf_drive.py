"""Extrai pares nome+CPF dos arquivos baixados do Google Drive."""
from __future__ import annotations

import io
import re
import unicodedata
from pathlib import Path

from docx import Document
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent / "drive_import"
OUT = Path(__file__).resolve().parent / "cpf_extracao.json"

CPF_RE = re.compile(r"\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b", re.I)


def norm_cpf(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw)
    if len(digits) != 11:
        return None
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


def norm_name(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"\s+", " ", name.upper().strip())
    name = re.sub(r"\s*\([^)]*\)\s*", " ", name).strip()
    return name


def parse_doc2(path: Path) -> dict[str, str]:
    doc = Document(path)
    text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    out: dict[str, str] = {}
    current_name: str | None = None

    for line in lines:
        cpfs = [norm_cpf(m) for m in CPF_RE.findall(line)]
        cpfs = [c for c in cpfs if c]
        upper = line.upper()

        if cpfs and ("CPF" in upper or "REFERENTE" in upper or "TOMADOR" in upper):
            name = current_name
            if not name:
                m = re.match(r"^([A-ZÀ-Ú][A-ZÀ-Ú\s\.\-']{5,}?)(?:\s+REFERENTE|\s+CPF|\s*,)", upper)
                if m:
                    name = norm_name(m.group(1))
            if name and name not in out:
                out[name] = cpfs[0]
            current_name = None
            continue

        if (
            len(line) >= 8
            and line == upper
            and not line.startswith("*")
            and "SESS" not in upper
            and "TEXTO" not in upper
            and "TODAS" not in upper
            and "VALOR" not in upper
            and "NÚMERO" not in upper
            and "NUMERO" not in upper
            and "FISIOTERAPEUTA" not in upper
            and "CREFITO" not in upper
            and not CPF_RE.search(line)
        ):
            current_name = norm_name(line)

    return out


def parse_pdf_nf(path: Path) -> dict[str, str]:
    reader = PdfReader(io.BytesIO(path.read_bytes()))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    out: dict[str, str] = {}

    # NFS-e POA: bloco Tomador / CPF/CNPJ
    blocks = re.split(r"Tomador do Servi[çc]o", text, flags=re.I)
    for block in blocks[1:]:
        cpf_match = re.search(r"CPF\s*/?\s*CNPJ\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})", block, re.I)
        if not cpf_match:
            continue
        cpf = norm_cpf(cpf_match.group(1))
        if not cpf:
            continue
        name_match = re.search(
            r"Nome\s*/?\s*Nome Empresarial\s*([^\n]+)",
            block,
            re.I,
        )
        if name_match:
            name = norm_name(name_match.group(1))
            if name and name not in out:
                out[name] = cpf

    # fallback: linhas com nome em caps + cpf próximo
    for m in re.finditer(
        r"([A-ZÀ-Ú][A-ZÀ-Ú\s\.\-']{8,})\s+.*?(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        text,
        re.S,
    ):
        name = norm_name(m.group(1))
        cpf = norm_cpf(m.group(2))
        if name and cpf and len(name.split()) >= 2 and name not in out:
            out[name] = cpf

    return out


def main() -> None:
    merged: dict[str, dict[str, str]] = {}

    doc2 = ROOT / "doc2.docx"
    if doc2.exists():
        merged["doc2"] = parse_doc2(doc2)

    for pdf in sorted(ROOT.glob("file*.bin")):
        if pdf.read_bytes()[:4] == b"%PDF":
            merged[pdf.name] = parse_pdf_nf(pdf)

    # merge único por nome
    final: dict[str, str] = {}
    sources: dict[str, list[str]] = {}
    for src, pairs in merged.items():
        for name, cpf in pairs.items():
            if name not in final:
                final[name] = cpf
                sources[name] = [src]
            elif final[name] != cpf:
                sources.setdefault(name, []).append(f"{src}:{cpf}")

    import json

    OUT.write_text(
        json.dumps({"pairs": final, "sources": sources, "by_file": merged}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("pairs", len(final))
    for name, cpf in sorted(final.items())[:25]:
        print(name, cpf)


if __name__ == "__main__":
    main()
