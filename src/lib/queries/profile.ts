import { supabase } from "@/integrations/supabase/client";

const PROFILE_MEDIA_BUCKET = "assinaturas-usuarios";
const MAX_AVATAR_BYTES = 524_288;

function avatarExtension(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

export function avatarStoragePath(userId: string, file: File): string {
  return `${userId}/avatar.${avatarExtension(file)}`;
}

export async function fetchProfileAvatarPath(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_storage_path")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const path = data?.avatar_storage_path;
  return path?.trim() ? path : null;
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem PNG, JPEG ou WebP.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("A imagem deve ter no máximo 512 KB.");
  }

  const path = avatarStoragePath(userId, file);
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_storage_path: path })
    .eq("id", userId);
  if (profileError) throw profileError;

  return path;
}

export async function getProfileAvatarSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function removeProfileAvatar(userId: string): Promise<void> {
  const path = await fetchProfileAvatarPath(userId);
  if (!path) return;

  const { error: removeError } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove([path]);
  if (removeError) throw removeError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_storage_path: null })
    .eq("id", userId);
  if (profileError) throw profileError;
}

export async function updateProfileDisplayName(userId: string, nome: string): Promise<void> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Informe um nome.");

  const { error: authError } = await supabase.auth.updateUser({ data: { nome: trimmed } });
  if (authError) throw authError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ nome: trimmed })
    .eq("id", userId);
  if (profileError) throw profileError;
}

export type ProfileAvatarState = {
  path: string | null;
  url: string | null;
};

export async function fetchProfileAvatar(userId: string): Promise<ProfileAvatarState> {
  const path = await fetchProfileAvatarPath(userId);
  if (!path) return { path: null, url: null };
  const url = await getProfileAvatarSignedUrl(path);
  return { path, url };
}
