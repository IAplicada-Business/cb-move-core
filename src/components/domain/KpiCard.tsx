import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Accent = "cyan" | "orange" | "magenta" | "lime" | "purple";

const ACCENT: Record<Accent, string> = {
  cyan: "before:bg-cb-cyan-600",
  orange: "before:bg-cb-orange",
  magenta: "before:bg-cb-magenta",
  lime: "before:bg-cb-lime",
  purple: "before:bg-cb-purple",
};

export function KpiCard({
  label,
  value,
  accent = "cyan",
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  accent?: Accent;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm",
        "before:absolute before:left-0 before:top-0 before:h-1 before:w-full",
        ACCENT[accent],
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
