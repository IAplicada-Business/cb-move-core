import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Accent = "cyan" | "orange" | "magenta" | "lime" | "purple";

const ACCENT_BAR: Record<Accent, string> = {
  cyan: "before:bg-gradient-to-r before:from-cb-cyan-500 before:to-cb-cyan-600",
  orange: "before:bg-gradient-to-r before:from-cb-orange before:to-[#fb923c]",
  magenta: "before:bg-gradient-to-r before:from-cb-magenta before:to-[#ec4899]",
  lime: "before:bg-gradient-to-r before:from-cb-lime before:to-[#84cc16]",
  purple: "before:bg-gradient-to-r before:from-cb-purple before:to-[#8b5cf6]",
};

const ACCENT_FILL: Record<Accent, string> = {
  cyan: "bg-gradient-to-r from-cb-cyan-500 to-cb-cyan-600",
  orange: "bg-cb-orange",
  magenta: "bg-cb-magenta",
  lime: "bg-cb-lime",
  purple: "bg-cb-purple",
};

const ICON_SHELL: Record<Accent, string> = {
  cyan: "bg-cb-cyan-050 text-cb-cyan-700 ring-cb-cyan-100 dark:bg-cb-cyan-900/40 dark:text-cb-cyan-300 dark:ring-cb-cyan-700/30",
  orange: "bg-[#FFF7ED] text-cb-orange ring-[#FED7AA] dark:bg-cb-orange/15 dark:ring-cb-orange/25",
  magenta:
    "bg-[#FDF2F8] text-cb-magenta ring-[#FBCFE8] dark:bg-cb-magenta/15 dark:ring-cb-magenta/25",
  lime: "bg-[#F7FEE7] text-[#3F6212] ring-[#BEF264] dark:bg-cb-lime/15 dark:text-cb-lime dark:ring-cb-lime/25",
  purple: "bg-[#F5F3FF] text-cb-purple ring-[#DDD6FE] dark:bg-cb-purple/15 dark:ring-cb-purple/25",
};

type DeltaTone = "up" | "down" | "neutral";

const DELTA_CLS: Record<DeltaTone, string> = {
  up: "rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[#059669] dark:bg-emerald-950/40",
  down: "rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[#E11D48] dark:bg-red-950/40",
  neutral: "text-cb-muted",
};

export function KpiCard({
  label,
  value,
  accent = "cyan",
  icon,
  hint,
  delta,
  share,
}: {
  label: string;
  value: ReactNode;
  accent?: Accent;
  icon?: ReactNode;
  hint?: string;
  delta?: { text: string; tone?: DeltaTone };
  share?: number;
}) {
  const shareClamped = share != null ? Math.min(100, Math.max(0, share)) : null;

  return (
    <div
      className={cn(
        "cb-glass-card cb-hover-lift relative flex flex-col overflow-hidden p-5 sm:p-6",
        "before:absolute before:inset-x-0 before:top-0 before:h-1",
        ACCENT_BAR[accent],
        shareClamped != null && "pb-4",
      )}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ring-inset",
              ICON_SHELL[accent],
            )}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cb-muted">
            {label}
          </p>
          <div className="mt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.03em] text-cb-ink tabular-nums sm:text-[28px]">
            {value}
          </div>
          {delta && (
            <p
              className={cn(
                "mt-2 inline-flex text-xs font-semibold",
                DELTA_CLS[delta.tone ?? "neutral"],
              )}
            >
              {delta.text}
            </p>
          )}
          {hint && !delta && <p className="mt-2 text-xs leading-snug text-cb-muted">{hint}</p>}
        </div>
      </div>

      {shareClamped != null && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn("h-full rounded-full transition-all", ACCENT_FILL[accent])}
            style={{ width: `${shareClamped}%` }}
          />
        </div>
      )}
    </div>
  );
}
