import re
from pathlib import Path

import requests

html = requests.get(
    "https://drive.google.com/drive/folders/1A6_5qq_GQuljJwEuO7lwAwzR0STRrZEV",
    timeout=30,
).text
out = Path(__file__).resolve().parent / "drive_import" / "folder.html"
out.write_text(html, encoding="utf-8")

for label in [
    "lista para emissao",
    "Frequ",
    "LogJur",
    "Relatório Financeiro 2026",
    "TEXTO PADRAO",
]:
    i = html.lower().find(label.lower())
    print(label, "pos", i)
    if i != -1:
        chunk = html[max(0, i - 800) : i + 800]
        ids = re.findall(r'["\']([a-zA-Z0-9_-]{20,})["\']', chunk)
        print(" ids", ids[:8])
