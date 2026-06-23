import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // SSR: window não existe → deixa o client-side redirect resolver via component
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/app" : "/login" });
  },
  // Exibe splash enquanto o JS carrega e o redirect client-side acontece.
  // Não pode ser null: servidor enviaria HTML vazio e o usuário veria tela em branco.
  component: Splash,
});

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div
          className="grid h-14 w-14 place-items-center rounded-full text-2xl font-bold text-cb-cyan-600"
          style={{
            background: "conic-gradient(from 130deg, #D946A0, #F58A1F, #C5D932, #3FB5BC, #7B4FB5, #D946A0)",
            padding: "2px",
          }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-white">∞</div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">CB MOVE Neuroscience</p>
      </div>
    </div>
  );
}
