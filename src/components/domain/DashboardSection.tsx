import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardPageProps = {
  children: ReactNode;
  className?: string;
};

/** Espaçamento vertical padrão entre blocos de dashboard. */
export function DashboardPage({ children, className }: DashboardPageProps) {
  return <div className={cn("space-y-8", className)}>{children}</div>;
}

export type DashboardSectionAccent = "cyan" | "purple" | "lime" | "orange" | "magenta";

const ACCENT_STRIP: Record<DashboardSectionAccent, string> = {
  cyan: "bg-cb-cyan-600",
  purple: "bg-cb-purple",
  lime: "bg-cb-lime",
  orange: "bg-cb-orange",
  magenta: "bg-cb-magenta",
};

const ACCENT_HEADER_BG: Record<DashboardSectionAccent, string> = {
  cyan: "bg-gradient-to-r from-cb-cyan-050/90 via-cb-cyan-050/35 to-transparent",
  purple: "bg-gradient-to-r from-[#F5F3FF]/90 via-[#F5F3FF]/35 to-transparent",
  lime: "bg-gradient-to-r from-[#F7FEE7]/90 via-[#F7FEE7]/35 to-transparent",
  orange: "bg-gradient-to-r from-[#FFF7ED]/90 via-[#FFF7ED]/35 to-transparent",
  magenta: "bg-gradient-to-r from-[#FDF2F8]/90 via-[#FDF2F8]/35 to-transparent",
};

type DashboardSectionProps = {
  title: ReactNode;
  description?: string;
  /** Rótulo superior (ex.: Financeiro, Detalhamento). */
  eyebrow?: string;
  /** Faixa lateral + fundo suave no cabeçalho. */
  accent?: DashboardSectionAccent;
  /** Chip ao lado do título (ex.: competência). */
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
};

/** Chip compacto para competência ou metadado no cabeçalho de seção. */
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
    cyan: "ring-cb-cyan-100 text-cb-cyan-800",
    purple: "ring-[#DDD6FE] text-cb-purple",
    lime: "ring-[#BEF264] text-[#3F6212]",
    orange: "ring-[#FED7AA] text-cb-orange",
    magenta: "ring-[#FBCFE8] text-cb-magenta",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border/80 bg-background/90 px-2.5 py-0.5",
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
};

/** Cabeçalho padrão de painéis — faixa lateral, eyebrow e chip de contexto. */
export function DashboardSectionHeader({
  title,
  description,
  eyebrow,
  accent = "cyan",
  badge,
  actions,
}: DashboardSectionHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5",
        ACCENT_HEADER_BG[accent],
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", ACCENT_STRIP[accent])} aria-hidden />
      <div className="min-w-0 max-w-2xl pl-1">
        {eyebrow && (
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-cb-muted">
            {eyebrow}
          </p>
        )}
        <div className={cn("flex flex-wrap items-center gap-2.5", eyebrow && "mt-1")}>
          <h2 className="text-lg font-bold tracking-tight text-cb-ink">{title}</h2>
          {badge}
        </div>
        {description && <p className="mt-2 text-sm leading-relaxed text-cb-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Painel com cabeçalho destacado — evita blocos “só texto” estilo Drive. */
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
}: DashboardSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border border-border bg-card",
        "shadow-[0_1px_2px_rgba(15,75,80,0.06)]",
        className,
      )}
    >
      <DashboardSectionHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        accent={accent}
        badge={badge}
        actions={actions}
      />
      <div className={cn(!noPadding && "p-6", bodyClassName)}>{children}</div>
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
  return <div className={cn("grid gap-5", KPI_COLS[columns], className)}>{children}</div>;
}
