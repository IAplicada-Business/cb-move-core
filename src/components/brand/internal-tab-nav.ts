import { cn } from "@/lib/utils";

/** Container padrão — barra pill branca (Configurações, Prontuário, Agenda, etc.). */
export const INTERNAL_TAB_NAV_LIST_CLASS =
  "cb-glass-toolbar flex h-auto w-full min-w-0 flex-wrap items-center justify-start gap-1.5 p-1.5 sm:w-auto";

/** Gatilho Radix TabsTrigger — alinhado ao padrão de Configurações. */
export const INTERNAL_TAB_TRIGGER_CLASS = cn(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ring-offset-background transition-all",
  "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "text-cb-muted hover:bg-cb-cyan-050 hover:text-cb-ink dark:hover:bg-secondary/80",
  "data-[state=active]:bg-cb-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_14px_rgba(63,181,188,0.35)]",
);

export function internalTabItemClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
    active
      ? "bg-cb-cyan-600 text-white shadow-[0_4px_14px_rgba(63,181,188,0.35)]"
      : "text-cb-muted hover:bg-cb-cyan-050 hover:text-cb-ink dark:hover:bg-secondary/80",
  );
}
