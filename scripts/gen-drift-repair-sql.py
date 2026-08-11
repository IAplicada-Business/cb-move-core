import os

REPO = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")
OUT = os.path.join(os.path.dirname(__file__), "out", "drift-repair-migrations.sql")

PROD_VERSIONS = {
    "20260623113526",
    "20260623120000",
    "20260623130000",
    "20260623140000",
    "20260707120000",
    "20260707164000",
    "20260707173000",
    "20260709120000",
    "20260709180000",
    "20260709200000",
    "20260709210000",
    "20260710100000",
    "20260710120000",
    "20260713120000",
    "20260713130000",
    "20260713140000",
    "20260714180000",
    "20260714190000",
    "20260714200000",
    "20260715120000",
    "20260715210000",
    "20260715230000",
    "20260716110000",
    "20260716120000",
    "20260716130000",
    "20260716170000",
    "20260717140000",
    "20260718000000",
    "20260806192130",
    "20260806201944",
}

rows: list[tuple[str, str]] = []
for filename in sorted(os.listdir(REPO)):
    if not filename.endswith(".sql"):
        continue
    version = filename.split("_")[0]
    name = "_".join(filename.split("_")[1:]).replace(".sql", "")
    if version in PROD_VERSIONS:
        continue
    rows.append((version, name))

rows = sorted(set(rows), key=lambda item: item[0])

values = ",\n".join(
    f"  ('{version}', '{name}', ARRAY['-- drift-repair: schema already applied in production']::text[])"
    for version, name in rows
)

sql = f"""-- Repair migration history drift (repo versions already live in prod schema)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
{values}
ON CONFLICT (version) DO NOTHING;
"""

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as handle:
    handle.write(sql)

print(f"Wrote {len(rows)} rows to {OUT}")
