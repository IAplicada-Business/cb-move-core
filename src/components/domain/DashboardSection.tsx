import type { ReactNode } from "react";

import { HeaderInfoTooltip } from "@/components/brand/HeaderInfoTooltip";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  children: ReactNode;
  className?: string;
};

/** Espaçamento vertical padrão entre blocos de dashboard. */
export function DashboardPage({ children, className }: DashboardPageProps) {
  return <div className={cn("w-full min-w-0 space-y-6 sm:space-y-7", className)}>{children}</div>;
}

export type DashboardSectionAccent = "cyan" | "purple" | "lime" | "orange" | "magenta";

const ACCENT_STRIP: Record<DashboardSectionAccent, string> = {
  cyan: "bg-gradient-to-b from-cb-cyan-500 to-cb-cyan-700",
  purple: "bg-gradient-to-b from-cb-purple to-[#6d28d9]",
  lime: "bg-gradient-to-b from-cb-lime to-[#65a30d]",
  orange: "bg-gradient-to-b from-cb-orange to-[#ea580c]",
  magenta: "bg-gradient-to-b from-cb-magenta to-[#db2777]",
};

export const ACCENT_HEADER_BG: Record<DashboardSectionAccent, string> = {
  cyan: "bg-gradient-to-r from-cb-cyan-050/90 via-white to-white dark:from-cb-cyan-900/40 dark:via-card dark:to-card",
  purple:
    "bg-gradient-to-r from-[#F5F3FF]/90 via-white to-white dark:from-cb-purple/25 dark:via-card dark:to-card",
  lime: "bg-gradient-to-r from-[#F7FEE7]/90 via-white to-white dark:from-cb-lime/20 dark:via-card dark:to-card",
  orange:
    "bg-gradient-to-r from-[#FFF7ED]/90 via-white to-white dark:from-cb-orange/20 dark:via-card dark:to-card",
  magenta:
    "bg-gradient-to-r from-[#FDF2F8]/90 via-white to-white dark:from-cb-magenta/20 dark:via-card dark:to-card",
};

type DashboardSectionProps = {
  title: ReactNode;
  description?: string;
  eyebrow?: string;
  accent?: DashboardSectionAccent;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
  compact?: boolean;
};

export function DashboardSectionBadge({
  children,
  accent = "cyan",
  className,
}: {
  children: ReactNode;
  accent?: DashboardSectionAccent;
  className?: string;
}) {
  const ring: Record<DashboardSectionAccent, string> = {
    cyan: "bg-cb-cyan-050 text-cb-cyan-800 ring-cb-cyan-100 dark:bg-cb-cyan-900/40 dark:text-cb-cyan-300 dark:ring-cb-cyan-700/40",
    purple:
      "bg-[#F5F3FF] text-cb-purple ring-[#DDD6FE] dark:bg-cb-purple/25 dark:text-[#c4b5fd] dark:ring-cb-purple/30",
    lime: "bg-[#F7FEE7] text-[#3F6212] ring-[#BEF264] dark:bg-cb-lime/20 dark:text-cb-lime dark:ring-cb-lime/25",
    orange:
      "bg-[#FFF7ED] text-cb-orange ring-[#FED7AA] dark:bg-cb-orange/20 dark:text-[#fdba74] dark:ring-cb-orange/30",
    magenta:
      "bg-[#FDF2F8] text-cb-magenta ring-[#FBCFE8] dark:bg-cb-magenta/20 dark:text-[#f9a8d4] dark:ring-cb-magenta/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tabular-nums tracking-wide ring-1",
        ring[accent],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type DashboardSectionHeaderProps = {
  title: ReactNode;
  description?: string;
  eyebrow?: string;
  accent?: DashboardSectionAccent;
  badge?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function DashboardSectionHeader({
  title,
  description,
  eyebrow,
  accent = "cyan",
  badge,
  actions,
  compact = false,
}: DashboardSectionHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex flex-wrap items-start justify-between gap-3 border-b border-border/40",
        compact ? "px-4 py-4 sm:px-5" : "px-5 py-5 sm:px-6",
        ACCENT_HEADER_BG[accent],
      )}
    >
      <div
        className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", ACCENT_STRIP[accent])}
        aria-hidden
      />
      <div className="min-w-0 flex-1 pl-3">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cb-cyan-700 dark:text-cb-cyan-400">
            {eyebrow}
          </p>
        )}
        <div className={cn("flex flex-wrap items-center gap-2.5", eyebrow && "mt-1")}>
          <h2
            className={cn(
              "font-extrabold tracking-tight text-cb-ink",
              compact ? "text-base" : "text-lg sm:text-xl",
            )}
          >
            {title}
          </h2>
          {description ? (
            <HeaderInfoTooltip description={description} iconClassName="h-3.5 w-3.5" />
          ) : null}
          {badge}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function DashboardSection({
  title,
  description,
  eyebrow,
  accent = "cyan",
  badge,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
  compact = false,
}: DashboardSectionProps) {
  return (
    <section className={cn("cb-glass-card overflow-hidden", className)}>
      <DashboardSectionHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        accent={accent}
        badge={badge}
        actions={actions}
        compact={compact}
      />
      <div className={cn(!noPadding && "p-5 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

type KpiGridProps = {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
};

const KPI_COLS: Record<NonNullable<KpiGridProps["columns"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
};

export function KpiGrid({ children, columns = 4, className }: KpiGridProps) {
  return <div className={cn("grid gap-4 sm:gap-5", KPI_COLS[columns], className)}>{children}</div>;
}
