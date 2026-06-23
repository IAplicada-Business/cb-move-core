import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · CB MOVE Neuroscience" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({ email: "", password: "", fullName: "" });

  React.useEffect(() => {
    if (session) navigate({ to: "/app" });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(form.email, form.password);
        toast.success("Bem-vindo de volta");
        navigate({ to: "/app" });
      } else {
        await signUp(form.email, form.password, form.fullName);
        toast.success("Conta criada. Verifique seu e-mail se necessário.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="cb-rainbow-strip h-[3px]" />
        <div className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="cb-pin-halo grid h-12 w-12 place-items-center rounded-full p-[2px]">
              <div className="grid h-full w-full place-items-center rounded-full bg-white text-cb-cyan-600">
                <span className="text-2xl font-bold leading-none">∞</span>
              </div>
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-wide text-cb-cyan-900">CB MOVE</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cb-cyan-700">Neuroscience</div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-md border bg-muted p-0.5 text-sm">
            {[
              { id: "signin", label: "Entrar" },
              { id: "signup", label: "Criar conta" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id as "signin" | "signup")}
                className={cn(
                  "rounded-[5px] py-1.5 font-medium transition-colors",
                  mode === t.id ? "bg-card text-cb-cyan-900 shadow-sm" : "text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
