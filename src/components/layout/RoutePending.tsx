import { Loader2 } from "lucide-react";

/** Skeleton genérico enquanto o chunk da rota ou beforeLoad carrega. */
export function RoutePending() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-cb-muted">
        <Loader2 className="h-4 w-4 animate-spin text-cb-cyan-600" />
        Carregando módulo…
      </div>
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-muted/70" />
          <div className="h-9 w-64 max-w-full rounded-lg bg-muted/60" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] rounded-[10px] border border-border bg-muted/30" />
          ))}
        </div>
        <div className="h-12 rounded-[10px] border border-border bg-muted/25" />
        <div className="h-72 rounded-[10px] border border-border bg-muted/20" />
      </div>
    </div>
  );
}
