-- Avatar de perfil do usuário (bucket assinaturas-usuarios, path {userId}/avatar.*)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

COMMENT ON COLUMN public.profiles.avatar_storage_path IS
  'Path no bucket assinaturas-usuarios (foto de perfil do usuário).';
