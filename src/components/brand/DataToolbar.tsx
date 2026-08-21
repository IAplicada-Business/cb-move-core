import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Altura e largura padrão dos filtros em toolbars de listagem.
 * Largura total no mobile (empilha e facilita o toque); largura fixa a
 * partir de sm: como no desktop.
 */
export const dataToolbarControlClass = "h-10 w-full shrink-0 sm:w-auto";
export const dataToolbarSelectClass = cn(dataToolbarControlClass, "sm:w-48");
export const dataToolbarFilterClass = cn(dataToolbarControlClass, "sm:w-56");

type DataToolbarProps = {
  children: ReactNode;
  className?: string;
};

export function DataToolbar({ children, className }: DataToolbarProps) {
  return (
    <div
      className={cn(
        "cb-glass-toolbar flex w-full min-w-0 flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DataToolbarSearchProps = {
  children: ReactNode;
  className?: string;
};

export function DataToolbarSearch({ children, className }: DataToolbarSearchProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-background/80 px-3.5 text-sm text-cb-muted shadow-sm backdrop-blur-sm sm:min-w-[240px]",
        dataToolbarControlClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
