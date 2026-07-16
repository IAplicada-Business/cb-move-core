#!/usr/bin/env python3
"""Corrige handle_new_user_v2 (trigger real em auth.users)."""
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

FIX_V2 = """
CREATE OR REPLACE FUNCTION public.handle_new_user_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      split_part(NEW.email, '@', 1)
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
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    IF v_role_text = 'cliente' AND NEW.raw_user_meta_data->>'paciente_id' IS NOT NULL THEN
      BEGIN
        v_paciente_id := (NEW.raw_user_meta_data->>'paciente_id')::uuid;
        UPDATE public.pacientes SET user_id = NEW.id WHERE id = v_paciente_id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
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
""".strip()


def mgmt_query(sql: str) -> object:
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
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}


def main() -> int:
    load_app_env()

    print("handle_new_user_v2 before:")
    print(json.dumps(mgmt_query(
        "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_user_v2';"
    ), indent=2)[:5000])

    print("\nApplying fix...")
    print(json.dumps(mgmt_query(FIX_V2), indent=2))

    print("\nhandle_new_user_v2 after:")
    print(json.dumps(mgmt_query(
        "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_user_v2';"
    ), indent=2)[:3000])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
