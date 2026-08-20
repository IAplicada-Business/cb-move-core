import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DataToolbarProps = {
  children: ReactNode;
  className?: string;
};

export function DataToolbar({ children, className }: DataToolbarProps) {
  return (
    <div
      className={cn(
        "cb-glass-toolbar flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-2.5 sm:px-4 sm:py-3",
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
        "flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm text-cb-muted backdrop-blur-sm sm:min-w-[220px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
