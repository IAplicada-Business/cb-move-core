import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardPageProps = {
  children: ReactNode;
  className?: string;
};

/** Espaçamento vertical padrão entre blocos de dashboard. */
export function DashboardPage({ children, className }: DashboardPageProps) {
  return <div className={cn("space-y-6 sm:space-y-8", className)}>{children}</div>;
}

export type DashboardSectionAccent = "cyan" | "purple" | "lime" | "orange" | "magenta";

const ACCENT_STRIP: Record<DashboardSectionAccent, string> = {
  cyan: "bg-cb-cyan-600",
  purple: "bg-cb-purple",
  lime: "bg-cb-lime",
  orange: "bg-cb-orange",
  magenta: "bg-cb-magenta",
};

export const ACCENT_HEADER_BG: Record<DashboardSectionAccent, string> = {
  cyan: "bg-gradient-to-r from-cb-cyan-050/95 via-cb-cyan-050/40 to-transparent dark:from-cb-cyan-900/50 dark:via-cb-cyan-800/20 dark:to-transparent",
  purple:
    "bg-gradient-to-r from-[#F5F3FF]/95 via-[#F5F3FF]/40 to-transparent dark:from-cb-purple/30 dark:via-cb-purple/12 dark:to-transparent",
  lime: "bg-gradient-to-r from-[#F7FEE7]/95 via-[#F7FEE7]/40 to-transparent dark:from-cb-lime/24 dark:via-cb-lime/10 dark:to-transparent",
  orange:
    "bg-gradient-to-r from-[#FFF7ED]/95 via-[#FFF7ED]/40 to-transparent dark:from-cb-orange/28 dark:via-cb-orange/12 dark:to-transparent",
  magenta:
    "bg-gradient-to-r from-[#FDF2F8]/95 via-[#FDF2F8]/40 to-transparent dark:from-cb-magenta/28 dark:via-cb-magenta/12 dark:to-transparent",
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
    cyan: "ring-cb-cyan-200/80 text-cb-cyan-800 dark:ring-cb-cyan-700/40 dark:text-cb-cyan-300",
    purple: "ring-[#DDD6FE] text-cb-purple dark:ring-cb-purple/30 dark:text-[#c4b5fd]",
    lime: "ring-[#BEF264] text-[#3F6212] dark:ring-cb-lime/25 dark:text-cb-lime",
    orange: "ring-[#FED7AA] text-cb-orange dark:ring-cb-orange/30 dark:text-[#fdba74]",
    magenta: "ring-[#FBCFE8] text-cb-magenta dark:ring-cb-magenta/30 dark:text-[#f9a8d4]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 bg-background/90 px-3 py-0.5",
        "text-xs font-bold tabular-nums tracking-wide ring-1",
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
        "relative flex flex-wrap items-start justify-between gap-3 border-b border-border/50",
        compact ? "px-4 py-4 sm:px-5" : "px-5 py-5 sm:px-6",
        ACCENT_HEADER_BG[accent],
      )}
    >
      <div
        className={cn("absolute inset-y-0 left-0 w-1 rounded-r-full", ACCENT_STRIP[accent])}
        aria-hidden
      />
      <div className="min-w-0 flex-1 pl-2">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cb-muted">
            {eyebrow}
          </p>
        )}
        <div className={cn("flex flex-wrap items-center gap-2.5", eyebrow && "mt-1")}>
          <h2
            className={cn(
              "font-bold tracking-tight text-cb-ink",
              compact ? "text-base" : "text-lg sm:text-xl",
            )}
          >
            {title}
          </h2>
          {badge}
        </div>
        {!compact && description && (
          <p className="mt-1.5 text-sm leading-relaxed text-cb-muted">{description}</p>
        )}
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
