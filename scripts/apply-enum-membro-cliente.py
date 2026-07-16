#!/usr/bin/env python3
"""Aplica enum membro/cliente e handle_new_user corrigido no remoto."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_app_env import load_app_env

PROJECT = "grlkbtnwvxorlfglyzid"

STEPS = [
    "ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'membro';",
    "ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';",
    """
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role_text text;
  v_role public.app_role;
  v_paciente_id uuid;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    ),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome, email = EXCLUDED.email;

  v_role_text := NEW.raw_user_meta_data->>'role';

  IF v_role_text IS NOT NULL AND v_role_text <> '' THEN
    BEGIN
      v_role := v_role_text::public.app_role;
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, v_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN invalid_text_representation THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'recepcao')
      ON CONFLICT (user_id, role) DO NOTHING;
    END;

    IF v_role = 'cliente' AND NEW.raw_user_meta_data->>'paciente_id' IS NOT NULL THEN
      v_paciente_id := (NEW.raw_user_meta_data->>'paciente_id')::uuid;
      UPDATE public.pacientes SET user_id = NEW.id WHERE id = v_paciente_id;
    END IF;
  ELSIF COALESCE(NEW.raw_user_meta_data->>'invited', 'false') = 'true' THEN
    NULL;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'recepcao')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
""".strip(),
]


def mgmt_query(sql: str) -> None:
    token = os.environ["SUPABASE_ACCESS_TOKEN"]
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            print("OK", res.read().decode()[:300])
    except urllib.error.HTTPError as e:
        print("ERR", e.code, e.read().decode()[:500])
        raise


def main() -> int:
    load_app_env()
    for step in STEPS:
        print("---")
        print(step[:80].replace("\n", " "), "...")
        mgmt_query(step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
