import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Accent = "cyan" | "orange" | "magenta" | "lime" | "purple";

const ACCENT_BAR: Record<Accent, string> = {
  cyan: "before:bg-gradient-to-r before:from-cb-cyan-400 before:to-cb-cyan-600",
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
  cyan: "bg-cb-cyan-050 text-cb-cyan-700 ring-cb-cyan-100 dark:bg-cb-cyan-900/50 dark:text-cb-cyan-300 dark:ring-cb-cyan-700/40",
  orange: "bg-[#FFF7ED] text-cb-orange ring-[#FED7AA] dark:bg-cb-orange/20 dark:ring-cb-orange/30",
  magenta:
    "bg-[#FDF2F8] text-cb-magenta ring-[#FBCFE8] dark:bg-cb-magenta/20 dark:ring-cb-magenta/30",
  lime: "bg-[#F7FEE7] text-[#3F6212] ring-[#BEF264] dark:bg-cb-lime/20 dark:text-cb-lime dark:ring-cb-lime/30",
  purple: "bg-[#F5F3FF] text-cb-purple ring-[#DDD6FE] dark:bg-cb-purple/20 dark:ring-cb-purple/30",
};

type DeltaTone = "up" | "down" | "neutral";

const DELTA_CLS: Record<DeltaTone, string> = {
  up: "rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  down: "rounded-full bg-red-50 px-2.5 py-0.5 text-red-600 dark:bg-red-950/40 dark:text-red-400",
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
        "before:absolute before:inset-x-0 before:top-0 before:h-1.5",
        ACCENT_BAR[accent],
        shareClamped != null && "pb-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cb-muted">{label}</p>
        {icon && (
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ring-inset",
              ICON_SHELL[accent],
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 text-[32px] font-extrabold leading-none tracking-[-0.04em] text-cb-ink tabular-nums sm:text-[34px]">
        {value}
      </div>

      {delta && (
        <p
          className={cn(
            "mt-2.5 inline-flex w-fit text-xs font-semibold",
            DELTA_CLS[delta.tone ?? "neutral"],
          )}
        >
          {delta.text}
        </p>
      )}
      {hint && !delta && <p className="mt-2.5 text-xs leading-snug text-cb-muted">{hint}</p>}

      {shareClamped != null && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-cb-cyan-050 dark:bg-muted/40">
          <div
            className={cn("h-full rounded-full transition-all duration-500", ACCENT_FILL[accent])}
            style={{ width: `${shareClamped}%` }}
          />
        </div>
      )}
    </div>
  );
}
