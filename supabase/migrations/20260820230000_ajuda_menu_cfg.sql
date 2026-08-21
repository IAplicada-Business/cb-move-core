-- Central de ajuda passou de Operação (app.ajuda / help.ajuda) para Configurações (cfg.ajuda).

INSERT INTO public.menu_permissions (role, menu_key, enabled, updated_at)
SELECT role, 'cfg.ajuda', enabled, now()
FROM public.menu_permissions
WHERE menu_key IN ('app.ajuda', 'help.ajuda')
ON CONFLICT (role, menu_key) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      updated_at = now();

DELETE FROM public.menu_permissions
WHERE menu_key IN ('app.ajuda', 'help.ajuda');

INSERT INTO public.menu_permissions (role, menu_key, enabled, updated_at)
VALUES ('membro', 'cfg.ajuda', true, now())
ON CONFLICT (role, menu_key) DO NOTHING;

INSERT INTO public.user_menu_permissions (user_id, menu_key, enabled, updated_at)
SELECT user_id, 'cfg.ajuda', enabled, now()
FROM public.user_menu_permissions
WHERE menu_key IN ('app.ajuda', 'help.ajuda')
ON CONFLICT (user_id, menu_key) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      updated_at = now();

DELETE FROM public.user_menu_permissions
WHERE menu_key IN ('app.ajuda', 'help.ajuda');
