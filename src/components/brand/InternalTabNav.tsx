import type { ReactNode } from "react";

import { INTERNAL_TAB_NAV_LIST_CLASS } from "@/components/brand/internal-tab-nav";
import { cn } from "@/lib/utils";

type InternalTabNavProps = {
  children: ReactNode;
  className?: string;
  "aria-label": string;
};

export function InternalTabNav({
  children,
  className,
  "aria-label": ariaLabel,
}: InternalTabNavProps) {
  return (
    <nav className={cn(INTERNAL_TAB_NAV_LIST_CLASS, className)} aria-label={ariaLabel}>
      {children}
    </nav>
  );
}
