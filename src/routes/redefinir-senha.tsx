import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/auth-routes";
import { AuthPageShell } from "@/components/layout/AuthLayout";
import { AuthBrandMark, AuthField } from "@/components/ui/auth-switch";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Definir senha · CB MOVE" }] }),
  component: RedefinirSenhaPage,
});

async function bootstrapSessionFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return false;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;

  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = React.useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-cb-ink">
        {label}
      </label>
      <div className="relative">
        <AuthField
          id={id}
          icon={Lock}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={6}
          required
          className="pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [ready, setReady] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  React.useEffect(() => {
    void (async () => {
      try {
        await bootstrapSessionFromHash();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          toast.error(
            "Faça login com a senha informada pela administração para definir sua senha.",
          );
          navigate({ to: "/login" });
          return;
        }
        setReady(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível validar a sessão");
        navigate({ to: "/login" });
      }
    })();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Sessão expirada. Faça login novamente.");

      const { error: passErr } = await supabase.auth.updateUser({ password });
      if (passErr) throw passErr;

      const { error: metaErr } = await supabase.auth.updateUser({
        data: { must_reset_password: false },
      });
      if (metaErr) throw metaErr;

      toast.success("Senha definida com sucesso");
      const path = await resolvePostAuthPath(userId);
      navigate({ to: path });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar senha");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <LoadingState />
      </div>
    );
  }

  return (
    <AuthPageShell>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="cb-rainbow-strip h-[3px]" />
        <div className="p-6 sm:p-8">
          <AuthBrandMark className="mb-6" />
          <h1 className="text-2xl font-bold text-foreground">Definir sua senha</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Primeiro acesso — escolha uma senha pessoal para entrar no sistema.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <PasswordField
              id="password"
              label="Nova senha"
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              id="confirm"
              label="Confirmar senha"
              value={confirm}
              onChange={setConfirm}
            />
            <Button
              type="submit"
              className="mt-2 h-11 w-full rounded-full bg-cb-cyan-600 font-semibold hover:bg-cb-cyan-700"
              disabled={loading}
            >
              {loading ? "Salvando…" : "Salvar e entrar"}
            </Button>
          </form>
        </div>
      </div>
    </AuthPageShell>
  );
}
