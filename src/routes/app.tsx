import * as React from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { mustResetPassword } from "@/lib/password-reset";
import { can, isCliente } from "@/lib/permissions";
import { diag } from "@/lib/client-diagnostics";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthRolesError } from "@/components/domain/AuthRolesError";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

function AppShell() {
  const { session, loading, roles, rolesReady, rolesError, isPaciente, user, refreshRoles } =
    useAuth();
  const navigate = useNavigate();

  const awaitingRoles = Boolean(session && !rolesReady && !rolesError);
  const mustRedirect =
    !loading &&
    session &&
    rolesReady &&
    !rolesError &&
    (mustResetPassword(user) || isCliente(roles) || isPaciente || !can.accessApp(roles));

  React.useEffect(() => {
    if (loading || awaitingRoles || rolesError) {
      if (loading) diag.info("guard:app", "aguardando auth");
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
      return;
    }
    if (!can.accessApp(roles)) {
      diag.info("guard:app", "sem papel de equipe → /sem-acesso", { roles });
      navigate({ to: "/sem-acesso" });
    }
  }, [loading, awaitingRoles, rolesError, session, roles, rolesReady, isPaciente, user, navigate]);

  if (loading || !session || awaitingRoles) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <LoadingState />
      </div>
    );
  }

  if (rolesError) {
    return <AuthRolesError onRetry={() => void refreshRoles()} />;
  }

  if (mustRedirect || !can.accessApp(roles)) {
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
