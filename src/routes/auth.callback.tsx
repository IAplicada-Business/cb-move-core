import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthPageShell } from "@/components/layout/AuthLayout";
import { LoadingState } from "@/components/domain/LoadingState";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Entrando… · CB MOVE Neuroscience" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { completeSignIn } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get("error_description") ?? params.get("error");
        if (oauthError) throw new Error(oauthError);

        const code = params.get("code");
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          const session = data.session;
          if (!session?.user) throw new Error("Não foi possível concluir o login com Google.");

          const path = await completeSignIn(session);
          navigate({ to: path });
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = data.session;
        if (!session?.user) {
          navigate({ to: "/login" });
          return;
        }

        const path = await completeSignIn(session);
        navigate({ to: path });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao entrar com Google";
        setError(message);
        toast.error(message);
      }
    })();
  }, [navigate, completeSignIn]);

  if (error) {
    return (
      <AuthPageShell>
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <p className="text-sm text-cb-muted">{error}</p>
          <Link
            to="/login"
            className="mt-4 inline-block text-sm font-semibold text-cb-cyan-700 hover:text-cb-cyan-900"
          >
            Voltar ao login
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <LoadingState />
    </AuthPageShell>
  );
}
