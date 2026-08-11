import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthRolesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          Não foi possível carregar seu perfil
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente. Se persistir, entre com e-mail e senha ou fale
          com a administração.
        </p>
        <Button className="mt-6 w-full" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
