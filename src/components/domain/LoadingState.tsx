import { Loader2 } from "lucide-react";

export function LoadingState({
  label = "Carregando…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-cb-cyan-600" />
        {label}
      </div>
    );
  }

  return (
    <div className="cb-glass-card flex items-center justify-center gap-2.5 p-10 text-sm text-muted-foreground sm:p-12">
      <Loader2 className="h-5 w-5 animate-spin text-cb-cyan-600" />
      {label}
    </div>
  );
}
