import { cn } from "@/lib/utils";

import { dataToolbarFilterClass } from "@/components/brand/DataToolbar";

/** Estilo do gatilho de chip da toolbar — alinhado ao SelectTrigger (h-10, rounded-xl). */
export const filterChipTriggerClass = cn(
  dataToolbarFilterClass,
  "inline-flex items-center justify-between gap-1.5 whitespace-nowrap rounded-xl border border-input bg-background/80 px-3.5",
  "text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-all",
  "hover:border-cb-cyan-400 hover:bg-cb-cyan-050/60 hover:shadow-md",
  "dark:hover:bg-cb-cyan-900/30",
);
