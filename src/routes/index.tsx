import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { resolvePostAuthPath } from "@/lib/auth-routes";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }

    void resolvePostAuthPath(session.user.id).then((path) => {
      navigate({ to: path, replace: true });
    });
  }, [loading, session, navigate]);

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
        <LoadingState />
      </div>
    </div>
  );
}
