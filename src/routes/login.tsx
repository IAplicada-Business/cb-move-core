import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { LoadingState } from "@/components/domain/LoadingState";
import type { AuthContext } from "@/components/ui/auth-switch";
import { LoginSignInCard } from "@/components/ui/login-sign-in-card";
import { useAuth } from "@/lib/auth";
import { resolvePostAuthPath } from "@/lib/auth-routes";
import { mustResetPassword } from "@/lib/password-reset";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · CB MOVE Neuroscience" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [authContext, setAuthContext] = React.useState<AuthContext>("admin");
  const [form, setForm] = React.useState({ email: "", password: "" });

  React.useEffect(() => {
    if (authLoading || !session) return;
    if (mustResetPassword(session.user)) {
      navigate({ to: "/redefinir-senha" });
      return;
    }
    void resolvePostAuthPath(session.user.id).then((path) => navigate({ to: path }));
  }, [authLoading, session, navigate]);

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#061418]">
        <LoadingState />
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const path = await signIn(form.email, form.password);
      navigate({ to: path });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Credenciais inválidas";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    if (!form.email.trim()) {
      toast.error("Informe o e-mail para receber o link de redefinição");
      return;
    }
    setResetLoading(true);
    try {
      const redirectTo = `${window.location.origin}/redefinir-senha`;
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
        redirectTo,
      });
      if (error) throw error;
      toast.success("Enviamos um link para redefinir a senha no seu e-mail");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o e-mail");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <LoginSignInCard
      accessType={authContext}
      onAccessTypeChange={setAuthContext}
      email={form.email}
      password={form.password}
      showPassword={showPassword}
      loading={loading}
      resetLoading={resetLoading}
      onEmailChange={(email) => setForm((current) => ({ ...current, email }))}
      onPasswordChange={(password) => setForm((current) => ({ ...current, password }))}
      onTogglePassword={() => setShowPassword((value) => !value)}
      onSubmit={onSubmit}
      onForgotPassword={onForgotPassword}
    />
  );
}
