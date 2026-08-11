#!/usr/bin/env pwsh
# Marca no Supabase remoto (linked) as migrations do repo já refletidas no schema de prod.
# Uso:
#   supabase login
#   pwsh scripts/repair-migration-drift.ps1

$ErrorActionPreference = "Stop"

$versions = @(
  "20260720120000",
  "20260720130000",
  "20260720140000",
  "20260720150000",
  "20260721180000",
  "20260721183000",
  "20260721203000",
  "20260721220000",
  "20260721223000",
  "20260722120000",
  "20260722234500",
  "20260722235500",
  "20260722240000",
  "20260722241000",
  "20260722242000",
  "20260722242500",
  "20260723140000",
  "20260723143000",
  "20260723160000",
  "20260723170000",
  "20260723180000",
  "20260727123000",
  "20260727150000",
  "20260727150100",
  "20260727184000",
  "20260727200000",
  "20260727210000",
  "20260727220000",
  "20260727230000",
  "20260727240000",
  "20260728180000",
  "20260728181000",
  "20260804120000",
  "20260804120100",
  "20260804140000",
  "20260804150000",
  "20260804160000",
  "20260806170000",
  "20260806192000",
  "20260810190000"
)

Write-Host "Reparando $($versions.Count) migrations no projeto linked..."
supabase migration repair --status applied --linked --yes @versions
Write-Host "Concluido. Verifique com: supabase migration list --linked"
