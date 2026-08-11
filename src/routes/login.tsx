import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { resolvePostAuthPath } from "@/lib/auth-routes";
import { mustResetPassword } from "@/lib/password-reset";
import { supabase } from "@/integrations/supabase/client";
import { AuthPageShell } from "@/components/layout/AuthLayout";
import { AuthField, AuthSwitchShell, type AuthContext } from "@/components/ui/auth-switch";
import { AuthGoogleButton, AuthSocialDivider } from "@/components/ui/auth-social-login";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/domain/LoadingState";

const FOOTNOTES: Record<AuthContext, string> = {
  admin: "Acesso restrito a usuários cadastrados pela administração.",
  paciente: "Primeiro acesso? Use a senha informada pela administração.",
};

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · CB MOVE Neuroscience" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signInWithGoogle, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
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
      <AuthPageShell>
        <LoadingState />
      </AuthPageShell>
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

  async function onGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível entrar com Google";
      toast.error(msg);
      setGoogleLoading(false);
      return;
    }
    window.setTimeout(() => {
      setGoogleLoading(false);
      toast.error("Não redirecionou para o Google. Recarregue a página (Ctrl+F5) e tente de novo.");
    }, 8_000);
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
    <AuthPageShell>
      <AuthSwitchShell mode={authContext} onModeChange={setAuthContext}>
        <form onSubmit={onSubmit} className="w-full">
          <AuthField
            id="email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="E-mail"
            aria-label="E-mail"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <div className="relative">
            <AuthField
              id="password"
              icon={Lock}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Senha"
              aria-label="Senha"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              className="pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="mt-4 h-11 w-full rounded-full bg-cb-cyan-600 text-sm font-semibold uppercase tracking-wide hover:bg-cb-cyan-700"
          >
            {loading ? "Aguarde…" : "Entrar"}
          </Button>

          <AuthSocialDivider />
          <AuthGoogleButton onClick={onGoogleSignIn} loading={googleLoading} disabled={loading} />

          <Button
            type="button"
            variant="link"
            className="mt-2 w-full text-xs text-cb-muted"
            disabled={resetLoading}
            onClick={onForgotPassword}
          >
            {resetLoading ? "Enviando link…" : "Esqueci minha senha"}
          </Button>

          <p className="mt-4 text-center text-xs text-cb-muted">{FOOTNOTES[authContext]}</p>
        </form>
      </AuthSwitchShell>
    </AuthPageShell>
  );
}
