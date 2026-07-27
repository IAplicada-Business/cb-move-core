import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/auth-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="cb-rainbow-strip h-[3px]" />
        <div className="p-8 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Definir sua senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Primeiro acesso — escolha uma senha pessoal para entrar no sistema.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando…" : "Salvar e entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
