-- Corrige fluxo de papéis após remove_recepcao_default_role:
-- staff operacional (membro sem fisioterapeuta_id) → admin no modelo de 3 perfis.
-- Alinha menu_permissions: gestão de usuários só para admin.

-- Promove membro operacional (sem cadastro clínico) para admin
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'membro'::public.app_role
WHERE p.fisioterapeuta_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.id
  AND ur.role = 'membro'::public.app_role
  AND p.fisioterapeuta_id IS NULL;

-- Metadata OAuth legada (ex.: recepcao) → admin para usuários promovidos
UPDATE auth.users au
SET raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'::public.app_role
WHERE au.id = p.id
  AND p.fisioterapeuta_id IS NULL
  AND COALESCE(au.raw_user_meta_data->>'role', '') IN ('recepcao', 'gestao', 'membro');

-- Menu: membros clínicos não veem gestão de usuários (guard exige admin)
INSERT INTO public.menu_permissions (role, menu_key, enabled, updated_at)
VALUES ('membro', 'team.usuarios', false, now())
ON CONFLICT (role, menu_key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    updated_at = EXCLUDED.updated_at;
