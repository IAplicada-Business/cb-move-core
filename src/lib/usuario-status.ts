import type { UserRow } from "@/lib/queries/usuarios";

/** Status de acesso com base em auth real — não usa referência estática. */
export function usuarioStatusLabel(user: UserRow | undefined): string {
  if (!user) return "Não cadastrado";
  if (user.last_sign_in_at) return "Ativo";
  if (user.must_reset_password === true) return "Aguardando 1º acesso";
  if (user.must_reset_password === false) return "Ativo";
  if (user.auth_meta_loaded === false) return "Cadastrado";
  return "Ativo";
}

export function usuarioAguardandoPrimeiroAcesso(user: UserRow | undefined): boolean {
  return usuarioStatusLabel(user) === "Aguardando 1º acesso";
}
