import * as React from "react";
import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/domain/LoadingState";
import { Button } from "@/components/ui/button";

export const Route = (createFileRoute as any)("/portal")({
  component: PortalShell,
});

function PortalShell() {
  const { session, loading, isPaciente, signOut } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
    // Usuário interno tentando acessar portal → manda pra /app
    if (!loading && session && !isPaciente) navigate({ to: "/app" });
  }, [loading, session, isPaciente, navigate]);

  if (loading || !session || !isPaciente) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header mobile-first */}
      <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-cb-cyan-600 text-white">
              <span className="text-sm font-bold leading-none">∞</span>
            </div>
            <span className="text-sm font-bold text-cb-cyan-900">CB MOVE</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          >
            Sair
          </Button>
        </div>
        {/* Nav tabs */}
        <nav className="flex overflow-x-auto border-t bg-white">
          {[
            { to: "/portal/", label: "Início" },
            { to: "/portal/sessoes", label: "Sessões" },
            { to: "/portal/exercicios", label: "Exercícios" },
            { to: "/portal/laudos", label: "Documentos" },
            { to: "/portal/contato", label: "Contato" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to as any}
              className="flex-shrink-0 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-cb-cyan-600 [&.active]:border-b-2 [&.active]:border-cb-cyan-600 [&.active]:text-cb-cyan-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <Outlet />
        </div>
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        CB MOVE Neuroscience · Todos os direitos reservados
      </footer>
    </div>
  );
}
