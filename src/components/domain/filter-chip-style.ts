import { cn } from "@/lib/utils";

/** Estilo do gatilho de chip da toolbar — compartilhado por FilterChip e filtros com conteúdo próprio. */
export const filterChipTriggerClass = cn(
  "inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1.5",
  "text-xs font-medium text-foreground transition-colors hover:border-cb-cyan-400",
);
