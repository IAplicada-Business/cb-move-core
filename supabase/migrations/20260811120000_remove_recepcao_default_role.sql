-- Remove fallback automático para papel legado recepcao em novos signups (OAuth/Google).
-- Papéis válidos na UI: admin, membro, cliente — atribuídos via create-user ou metadata.role.

-- Usuários legados recepcao foram migrados em 20260811120000; corrigidos para admin
-- em 20260811140000_user_flow_cleanup quando staff operacional (sem fisioterapeuta_id).
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'membro'::public.app_role
FROM public.user_roles ur
WHERE ur.role = 'recepcao'::public.app_role
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles WHERE role = 'recepcao'::public.app_role;

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
  END IF;
  -- Sem role em metadata: não atribui papel (acesso via cadastro admin / convite).

  RETURN NEW;
END;
$$;

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
  END IF;
  -- Sem role em metadata: não atribui papel (Google OAuth exige cadastro prévio).

  RETURN NEW;
END;
$$;

-- Garante trigger ativo apontando para v2
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_v2();
