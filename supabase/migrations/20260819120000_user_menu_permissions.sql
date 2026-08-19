-- Permissões de menu por usuário (overrides do padrão do papel membro).
-- Admin continua com acesso total; fisio clínico mantém menu fixo no front.

CREATE TABLE IF NOT EXISTS public.user_menu_permissions (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  menu_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, menu_key)
);

CREATE INDEX IF NOT EXISTS user_menu_permissions_user_id_idx
  ON public.user_menu_permissions (user_id);

ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_menu_permissions'
      AND policyname = 'auth read own user_menu_permissions'
  ) THEN
    CREATE POLICY "auth read own user_menu_permissions"
      ON public.user_menu_permissions
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_menu_permissions'
      AND policyname = 'admin manage user_menu_permissions'
  ) THEN
    CREATE POLICY "admin manage user_menu_permissions"
      ON public.user_menu_permissions
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

GRANT SELECT ON public.user_menu_permissions TO authenticated;
GRANT ALL ON public.user_menu_permissions TO service_role;
