import * as React from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { mustResetPassword } from "@/lib/password-reset";
import { isCliente } from "@/lib/permissions";
import { diag } from "@/lib/client-diagnostics";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

function AppShell() {
  const { session, loading, roles, isPaciente, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (loading) {
      diag.info("guard:app", "aguardando auth");
      return;
    }
    if (!session) {
      diag.info("guard:app", "sem sessão → /login");
      navigate({ to: "/login" });
      return;
    }
    if (mustResetPassword(user)) {
      diag.info("guard:app", "must_reset_password → /redefinir-senha");
      navigate({ to: "/redefinir-senha" });
      return;
    }
    if (isCliente(roles) || isPaciente) {
      diag.info("guard:app", "usuário portal → /portal", { roles, isPaciente });
      navigate({ to: "/portal" });
    }
  }, [loading, session, roles, isPaciente, user, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <LoadingState />
      </div>
    );
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
