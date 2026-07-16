#!/usr/bin/env python3
"""Aplica migration usuarios_acessos em passos idempotentes."""
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
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
""".strip(),
    """
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_user_id
  ON public.pacientes(user_id)
  WHERE user_id IS NOT NULL;
""".strip(),
    """
DO $$ BEGIN
  CREATE POLICY "admins read all profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
""".strip(),
    """
CREATE TABLE IF NOT EXISTS public.menu_permissions (
  role public.app_role NOT NULL,
  menu_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, menu_key),
  CONSTRAINT menu_permissions_role_check CHECK (role IN ('membro', 'cliente'))
);
""".strip(),
    "ALTER TABLE public.menu_permissions ENABLE ROW LEVEL SECURITY;",
    """
DO $$ BEGIN
  CREATE POLICY "auth read menu_permissions"
    ON public.menu_permissions FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
""".strip(),
    """
DO $$ BEGIN
  CREATE POLICY "admin manage menu_permissions"
    ON public.menu_permissions FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
""".strip(),
    "GRANT SELECT ON public.menu_permissions TO authenticated;",
    "GRANT ALL ON public.menu_permissions TO service_role;",
    """
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role = _role
        OR (
          _role IN ('gestao', 'recepcao', 'fisio', 'membro')
          AND ur.role IN ('membro', 'gestao', 'recepcao', 'fisio')
        )
      )
  )
$$;
""".strip(),
    """
CREATE OR REPLACE FUNCTION public.paciente_logado()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id
  FROM public.pacientes p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;
""".strip(),
    "GRANT EXECUTE ON FUNCTION public.paciente_logado() TO authenticated;",
    """
CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  role public.app_role,
  paciente_id uuid,
  paciente_nome text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id,
    p.nome,
    p.email,
    p.created_at,
    (
      SELECT ur.role
      FROM public.user_roles ur
      WHERE ur.user_id = p.id
      ORDER BY ur.created_at
      LIMIT 1
    ) AS role,
    pac.id AS paciente_id,
    pac.nome AS paciente_nome
  FROM public.profiles p
  LEFT JOIN public.pacientes pac ON pac.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY COALESCE(p.nome, p.email);
$$;
""".strip(),
    "GRANT EXECUTE ON FUNCTION public.list_users() TO authenticated;",
    """
INSERT INTO public.menu_permissions (role, menu_key, enabled) VALUES
  ('membro', 'app.dashboard', true),
  ('membro', 'app.pacientes', true),
  ('membro', 'app.prontuario', true),
  ('membro', 'app.agenda', true),
  ('membro', 'fin.cobrancas', false),
  ('membro', 'fin.notas-fiscais', false),
  ('membro', 'fin.relatorios', false),
  ('membro', 'team.fisios', true),
  ('membro', 'team.usuarios', false),
  ('membro', 'cfg.geral', false),
  ('membro', 'cfg.convenios', false),
  ('membro', 'cfg.instrumentos', false),
  ('membro', 'cfg.templates', false),
  ('membro', 'cfg.integracoes', false),
  ('membro', 'help.ajuda', true)
ON CONFLICT (role, menu_key) DO NOTHING;
""".strip(),
    """
UPDATE public.profiles
SET nome = 'Mariana'
WHERE email = 'mariana@iaplicada.com'
  AND (nome IS NULL OR nome = email);
""".strip(),
    """
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
""".strip(),
]


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
        with urllib.request.urlopen(req, timeout=180) as res:
            return json.loads(res.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}


def main() -> int:
    load_app_env()
    if not os.environ.get("SUPABASE_ACCESS_TOKEN"):
        print("SUPABASE_ACCESS_TOKEN ausente", file=sys.stderr)
        return 1

    failed = 0
    for i, step in enumerate(STEPS, 1):
        label = step.replace("\n", " ")[:70]
        print(f"\n--- step {i}/{len(STEPS)}: {label}...")
        result = mgmt_query(step)
        if isinstance(result, dict) and result.get("error"):
            print("ERR", result)
            failed += 1
        else:
            print("OK", json.dumps(result)[:200] if result else "ok")

    print(f"\nDone. failures={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
