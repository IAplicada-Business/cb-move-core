#!/usr/bin/env python3
"""Inspeciona e corrige handle_new_user no remoto."""
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


FIX_TRIGGER = """
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
    EXCEPTION WHEN invalid_text_representation OR OTHERS THEN
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
  END IF;
  -- Sem role em metadata: não atribui papel (acesso via cadastro admin / convite).

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;
""".strip()


def main() -> int:
    load_app_env()

    print("profiles columns:")
    print(json.dumps(mgmt_query(
        "SELECT column_name, data_type, is_nullable "
        "FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position;"
    ), indent=2))

    print("\nprofiles constraints:")
    print(json.dumps(mgmt_query(
        "SELECT conname, pg_get_constraintdef(oid) AS def "
        "FROM pg_constraint WHERE conrelid='public.profiles'::regclass;"
    ), indent=2))

    print("\nhandle_new_user:")
    print(json.dumps(mgmt_query(
        "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_user';"
    ), indent=2)[:4000])

    print("\napp_role values:")
    print(json.dumps(mgmt_query(
        "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid "
        "WHERE t.typname='app_role' ORDER BY enumsortorder;"
    ), indent=2))

    print("\nApplying fixed trigger...")
    print(json.dumps(mgmt_query(FIX_TRIGGER), indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
