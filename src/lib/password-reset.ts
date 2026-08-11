import type { User } from "@supabase/supabase-js";

export type PostAuthPath = "/app" | "/portal" | "/redefinir-senha" | "/sem-acesso";

export function hasGoogleIdentity(user: User | null | undefined): boolean {
  if (!user) return false;
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes("google")) return true;
  return user.identities?.some((identity) => identity.provider === "google") ?? false;
}

/** Exige redefinição de senha no 1º acesso — exceto login Google (OAuth). */
export function mustResetPassword(user: User | null | undefined): boolean {
  if (!user?.user_metadata?.must_reset_password) return false;
  if (hasGoogleIdentity(user)) return false;
  return user.user_metadata.must_reset_password === true;
}
