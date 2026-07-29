import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DataToolbarProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Barra de filtros/busca dentro de card — padrão `.toolbar` do mockup.
 * Staged — usar nas rotas somente após autorização de produção.
 */
export function DataToolbar({ children, className }: DataToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-card px-3 py-2.5",
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
        "flex min-w-[200px] flex-1 items-center gap-2 rounded-lg bg-background px-2.5 py-1.5 text-sm text-cb-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
