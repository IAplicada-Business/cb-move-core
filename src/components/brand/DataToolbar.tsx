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
        "flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-cb-cyan-100 bg-cb-cyan-050/40 px-3.5 py-2.5 text-sm text-cb-muted dark:border-border dark:bg-secondary/40 sm:min-w-[240px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
