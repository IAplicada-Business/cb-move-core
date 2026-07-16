import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { resolvePostAuthPath } from "@/lib/auth-routes";
import { mustResetPassword } from "@/lib/password-reset";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · CB MOVE Neuroscience" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
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
      <div className="grid min-h-screen place-items-center bg-background">
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
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), { redirectTo });
      if (error) throw error;
      toast.success("Enviamos um link para redefinir a senha no seu e-mail");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o e-mail");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="cb-rainbow-strip h-[3px]" />
        <div className="p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="cb-pin-halo grid h-12 w-12 place-items-center rounded-full p-[2px]">
              <div className="grid h-full w-full place-items-center rounded-full bg-white text-cb-cyan-600">
                <span className="text-2xl font-bold leading-none">∞</span>
              </div>
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-wide text-cb-cyan-900">CB MOVE</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cb-cyan-700">Neuroscience</div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Aguarde…" : "Entrar"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full text-xs"
              disabled={resetLoading}
              onClick={onForgotPassword}
            >
              {resetLoading ? "Enviando link…" : "Esqueci minha senha"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Acesso restrito a usuários cadastrados pela administração.
            <br />
            Primeiro acesso? Use a senha informada pela administração.
          </p>
        </div>
      </div>
    </div>
  );
}
