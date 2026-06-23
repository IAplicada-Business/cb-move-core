import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Splash,
});

// No SSR, beforeLoad com redirect não funciona porque window não existe.
// O componente Splash detecta a sessão client-side e navega manualmente.
function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      // Verifica se é paciente
      const { data: pac } = await (supabase as any)
        .from("pacientes")
        .select("id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      navigate({ to: pac ? "/portal" : "/app", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div
          className="grid h-14 w-14 place-items-center rounded-full"
          style={{
            background: "conic-gradient(from 130deg, #D946A0, #F58A1F, #C5D932, #3FB5BC, #7B4FB5, #D946A0)",
            padding: "2px",
          }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-white text-2xl font-bold text-cb-cyan-600">
            ∞
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">CB MOVE Neuroscience</p>
      </div>
    </div>
  );
}
