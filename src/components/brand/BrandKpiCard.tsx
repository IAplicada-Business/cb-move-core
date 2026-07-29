import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Accent = "cyan" | "orange" | "magenta" | "lime" | "purple";

const ACCENT: Record<Accent, string> = {
  cyan: "before:bg-cb-cyan-600",
  orange: "before:bg-cb-orange",
  magenta: "before:bg-cb-magenta",
  lime: "before:bg-cb-lime",
  purple: "before:bg-cb-purple",
};

type DeltaTone = "up" | "down" | "neutral";

const DELTA_CLS: Record<DeltaTone, string> = {
  up: "text-[#10B981]",
  down: "text-[#E11D48]",
  neutral: "text-cb-muted",
};

type BrandKpiCardProps = {
  label: string;
  value: ReactNode;
  accent?: Accent;
  icon?: ReactNode;
  hint?: string;
  delta?: { text: string; tone?: DeltaTone };
};

/**
 * KPI com faixa 3px, valor 28px e delta opcional — padrão `.kpi` do mockup.
 * Staged — substituir KpiCard após autorização.
 */
export function BrandKpiCard({
  label,
  value,
  accent = "cyan",
  icon,
  hint,
  delta,
}: BrandKpiCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] border border-border bg-card px-5 py-[18px]",
        "shadow-[0_1px_2px_rgba(15,75,80,0.06)]",
        "before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
        ACCENT[accent],
      )}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-cb-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1.5 text-[28px] font-extrabold leading-none tracking-[-0.02em] text-cb-ink tabular-nums">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-xs font-semibold",
            DELTA_CLS[delta.tone ?? "neutral"],
          )}
        >
          {delta.text}
        </div>
      )}
      {hint && !delta && <div className="mt-1.5 text-xs text-cb-muted">{hint}</div>}
    </div>
  );
}
