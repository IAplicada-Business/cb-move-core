import type { User } from "@supabase/supabase-js";

export type PostAuthPath = "/app" | "/portal" | "/redefinir-senha" | "/sem-acesso";

export function mustResetPassword(user: User | null | undefined): boolean {
  return user?.user_metadata?.must_reset_password === true;
}
