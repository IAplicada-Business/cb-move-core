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

function formatOAuthError(raw: string): string {
  const msg = decodeURIComponent(raw.replace(/\+/g, " "));
  const lower = msg.toLowerCase();
  if (lower.includes("access_denied") || lower.includes("denied access")) {
    return "Login com Google cancelado ou bloqueado. Se o app Google ainda estiver em Testing, publique em produção ou adicione seu e-mail em Usuários de teste no Google Cloud.";
  }
  if (lower.includes("redirect") && lower.includes("not allowed")) {
    return "URL de retorno não autorizada no Supabase. Avise o suporte técnico.";
  }
  if (
    lower.includes("invalid flow state") ||
    lower.includes("code challenge") ||
    lower.includes("code verifier") ||
    lower.includes("auth code") ||
    lower.includes("pkce")
  ) {
    return "Sessão de login expirou ou foi interrompida. Volte ao login e tente novamente (use Ctrl+F5 se persistir).";
  }
  return msg;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { completeSignIn } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get("error_description") ?? params.get("error");
        if (oauthError) throw new Error(formatOAuthError(oauthError));

        const code = params.get("code");
        if (code) {
          // Evita reutilizar o code se o usuário recarregar a página.
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          window.history.replaceState(window.history.state, "", cleanUrl.toString());

          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw new Error(formatOAuthError(exchangeError.message));

          const session = data.session;
          if (!session?.user) throw new Error("Não foi possível concluir o login com Google.");

          const path = await completeSignIn(session);
          navigate({ to: path, replace: true });
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = data.session;
        if (!session?.user) {
          navigate({ to: "/login", replace: true });
          return;
        }

        const path = await completeSignIn(session);
        navigate({ to: path, replace: true });
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
