import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { AuthPageShell } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/sem-acesso")({
  head: () => ({ meta: [{ title: "Sem acesso · CB MOVE Neuroscience" }] }),
  component: SemAcessoPage,
});

function SemAcessoPage() {
  const { signOut, user } = useAuth();

  return (
    <AuthPageShell>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
          <ShieldOff className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Acesso não configurado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user?.email ? (
            <>
              A conta <span className="font-medium text-foreground">{user.email}</span> entrou com
              sucesso, mas ainda não tem perfil de acesso no CBmove.
            </>
          ) : (
            <>Esta conta ainda não tem perfil de acesso no CBmove.</>
          )}{" "}
          Solicite cadastro à administração da clínica.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void signOut().then(() => {
                window.location.href = "/login";
              });
            }}
          >
            Sair e usar outra conta
          </Button>
          <Link to="/login" className="text-sm font-medium text-cb-cyan-700 hover:text-cb-cyan-900">
            Voltar ao login
          </Link>
        </div>
      </div>
    </AuthPageShell>
  );
}
