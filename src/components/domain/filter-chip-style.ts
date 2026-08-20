import { cn } from "@/lib/utils";

/** Estilo do gatilho de chip da toolbar — compartilhado por FilterChip e filtros com conteúdo próprio. */
export const filterChipTriggerClass = cn(
  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3.5 py-1.5",
  "text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all",
  "hover:border-cb-cyan-400 hover:bg-cb-cyan-050/60 hover:shadow-md",
  "dark:hover:bg-cb-cyan-900/30",
);
