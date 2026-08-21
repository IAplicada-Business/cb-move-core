import { Loader2 } from "lucide-react";

/** Skeleton genérico enquanto o chunk da rota ou beforeLoad carrega. */
export function RoutePending() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <div className="flex items-center gap-2.5 text-sm font-medium text-cb-muted">
        <Loader2 className="h-4 w-4 animate-spin text-cb-cyan-600" />
        Carregando módulo…
      </div>
      <div className="animate-pulse space-y-6">
        <div className="cb-glass-card h-24" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="cb-glass-card h-[120px]" />
          ))}
        </div>
        <div className="cb-glass-card h-14" />
        <div className="cb-glass-card h-80" />
      </div>
    </div>
  );
}
