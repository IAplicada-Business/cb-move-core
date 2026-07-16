import * as React from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { isCliente } from "@/lib/permissions";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

function AppShell() {
  const { session, loading, roles, isPaciente } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
    if (!loading && session && (isCliente(roles) || isPaciente)) {
      navigate({ to: "/portal" });
    }
  }, [loading, session, roles, isPaciente, navigate]);

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
