import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Accent = "cyan" | "orange" | "magenta" | "lime" | "purple";

const ACCENT_BAR: Record<Accent, string> = {
  cyan: "before:bg-cb-cyan-600",
  orange: "before:bg-cb-orange",
  magenta: "before:bg-cb-magenta",
  lime: "before:bg-cb-lime",
  purple: "before:bg-cb-purple",
};

const ACCENT_FILL: Record<Accent, string> = {
  cyan: "bg-cb-cyan-600",
  orange: "bg-cb-orange",
  magenta: "bg-cb-magenta",
  lime: "bg-cb-lime",
  purple: "bg-cb-purple",
};

const ICON_SHELL: Record<Accent, string> = {
  cyan: "bg-cb-cyan-050 text-cb-cyan-700 ring-cb-cyan-100",
  orange: "bg-[#FFF7ED] text-cb-orange ring-[#FED7AA]",
  magenta: "bg-[#FDF2F8] text-cb-magenta ring-[#FBCFE8]",
  lime: "bg-[#F7FEE7] text-[#3F6212] ring-[#BEF264]",
  purple: "bg-[#F5F3FF] text-cb-purple ring-[#DDD6FE]",
};

type DeltaTone = "up" | "down" | "neutral";

const DELTA_CLS: Record<DeltaTone, string> = {
  up: "text-[#059669]",
  down: "text-[#E11D48]",
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
  /** 0–100 — barra de proporção na base do card */
  share?: number;
}) {
  const shareClamped = share != null ? Math.min(100, Math.max(0, share)) : null;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[10px] border border-border bg-card p-5",
        "shadow-[0_1px_2px_rgba(15,75,80,0.06)]",
        "before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
        ACCENT_BAR[accent],
        shareClamped != null && "pb-4",
      )}
    >
      <div className="flex items-start gap-3.5">
        {icon && (
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
              ICON_SHELL[accent],
            )}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cb-muted">
            {label}
          </p>
          <div className="mt-1 text-[28px] font-extrabold leading-none tracking-[-0.02em] text-cb-ink tabular-nums">
            {value}
          </div>
          {delta && (
            <p className={cn("mt-2 text-xs font-semibold", DELTA_CLS[delta.tone ?? "neutral"])}>
              {delta.text}
            </p>
          )}
          {hint && !delta && <p className="mt-2 text-xs leading-snug text-cb-muted">{hint}</p>}
        </div>
      </div>

      {shareClamped != null && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn("h-full rounded-full transition-all", ACCENT_FILL[accent])}
            style={{ width: `${shareClamped}%` }}
          />
        </div>
      )}
    </div>
  );
}
