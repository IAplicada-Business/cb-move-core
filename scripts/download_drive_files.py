import json
import re
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent / "drive_import"
OUT.mkdir(parents=True, exist_ok=True)

FILES = {
    "lista_nf.docx": ("doc", "1TMYRNXdfBS9ZqHpHlLQz65BevW5yzekc"),
    "logjur.xlsm": ("bin", "1V0gAT8GGQsoxvoa81jCyBpXKb2tpbjVb"),
    "frequencia2026.xlsx": ("xlsx", "1Wrax3PM1NWoFBJ_aWNrWydlIxJi_DFfP"),
    "relatorio_financeiro_2026.xlsx": ("sheet", "1gaAM58gv9zWCdyF8-Kp7di6WvpC9EFgeS5FsSpxV8Y0"),
    "texto_padrao_nf.docx": ("doc", "1H4hhl5P_gwjm5Jo-0x93mocBg9ndOTPs"),
    "nf_cleidi.pdf": ("bin", "1Fcyr9X9UB_ioabjMdS-nkP8NfYn2oyDR"),
    "nf_dilso.pdf": ("bin", "1iB2cKpuhR6gYiIHsu5MMH0SzPaoPjLPV"),
    "nf_amanda.pdf": ("bin", "1ADN5-xJvN3qRUDEy3R2SRsLfAbJB-spn"),
    "nf_airton.pdf": ("bin", "16CNuUqVx9_qTWrq8M2uQ-osOEbi-L0yE"),
    "nf_2185.pdf": ("bin", "1m1SJmhZx4GhyZwp9jCCv6wFnLFjxY-NC"),
    "nf_unimed.pdf": ("bin", "1hlhsau9zb2S1l4JYVfpSEvuP3J40MZgC"),
}


def url_for(kind: str, file_id: str) -> str:
    if kind == "doc":
        return f"https://docs.google.com/document/d/{file_id}/export?format=docx"
    if kind == "sheet":
        return f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx"
    if kind == "xlsx":
        return f"https://drive.google.com/uc?export=download&id={file_id}"
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def download(name: str, kind: str, file_id: str) -> dict:
    dest = OUT / name
    session = requests.Session()
    r = session.get(url_for(kind, file_id), timeout=120, allow_redirects=True)
    if "text/html" in r.headers.get("content-type", "") and "confirm=" in r.text:
        m = re.search(r"confirm=([0-9A-Za-z_]+)", r.text)
        if m:
            r = session.get(
                f"https://drive.google.com/uc?export=download&confirm={m.group(1)}&id={file_id}",
                timeout=120,
            )
    dest.write_bytes(r.content)
    return {"name": name, "bytes": dest.stat().st_size, "id": file_id}


results = [download(n, k, i) for n, (k, i) in FILES.items()]
print(json.dumps(results, indent=2))
