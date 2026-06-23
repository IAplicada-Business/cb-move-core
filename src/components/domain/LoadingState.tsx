import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border bg-card p-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-cb-cyan-600" />
      {label}
    </div>
  );
}
