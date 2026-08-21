import type { ReactNode } from "react";

import {
  INTERNAL_TAB_NAV_LIST_CLASS,
  internalTabItemClass,
} from "@/components/brand/internal-tab-nav";
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

type InternalTabNavButtonProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

export function InternalTabNavButton({
  active,
  onClick,
  children,
  className,
}: InternalTabNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(internalTabItemClass(active), className)}
    >
      {children}
    </button>
  );
}
