import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthPageShell } from "@/components/layout/AuthLayout";
import { LoadingState } from "@/components/domain/LoadingState";
import { useAuth } from "@/lib/auth";
import { diag } from "@/lib/client-diagnostics";
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

const SESSION_POLL_MS = 150;
const SESSION_POLL_MAX = 80;

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { completeSignIn } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const handledRef = React.useRef(false);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    let cancelled = false;

    const finishSignIn = async (
      session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>,
    ) => {
      if (completedRef.current || cancelled) return;
      completedRef.current = true;

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("code");
      cleanUrl.searchParams.delete("state");
      window.history.replaceState(window.history.state, "", cleanUrl.toString());

      const path = await completeSignIn(session);
      if (!cancelled) navigate({ to: path, replace: true });
    };

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get("error_description") ?? params.get("error");
        if (oauthError) throw new Error(formatOAuthError(oauthError));

        const code = params.get("code");
        if (!code) {
          diag.warn("auth", "callback OAuth sem code — redirecionando ao login");
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }

        diag.info("auth", "callback OAuth: aguardando sessão (detectSessionInUrl)");

        const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled || !session?.user) return;
          if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;

          diag.info("auth", "callback OAuth: sessão via onAuthStateChange", { event });
          void finishSignIn(session).catch((err) => {
            handledRef.current = false;
            const message = err instanceof Error ? err.message : "Falha ao entrar com Google";
            setError(message);
            toast.error(message);
          });
        });

        for (let attempt = 0; attempt < SESSION_POLL_MAX; attempt += 1) {
          if (cancelled) break;

          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          if (data.session?.user) {
            diag.info("auth", "callback OAuth: sessão detectada", {
              attempt,
              userId: data.session.user.id,
            });
            authSub.subscription.unsubscribe();
            await finishSignIn(data.session);
            return;
          }

          await new Promise((resolve) => window.setTimeout(resolve, SESSION_POLL_MS));
        }

        authSub.subscription.unsubscribe();
        diag.warn("auth", "callback OAuth: sessão não encontrada após polling");
        if (!cancelled) navigate({ to: "/login", replace: true });
      } catch (err) {
        handledRef.current = false;
        const message = err instanceof Error ? err.message : "Falha ao entrar com Google";
        setError(message);
        toast.error(message);
      }
    })();

    return () => {
      cancelled = true;
    };
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
