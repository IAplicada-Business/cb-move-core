import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";
import { TIPO_BAR_COLORS } from "@/lib/chart-brand";

export { TIPO_BAR_COLORS };

type Segment = {
  label: string;
  value: number;
  colorClass: string;
};

type StatusDistributionBarProps = {
  segments: Segment[];
  totalLabel?: string;
  formatValue?: (n: number) => string;
  className?: string;
};

/** Barra segmentada + legenda — composição visual para KPIs financeiros. */
export function StatusDistributionBar({
  segments,
  totalLabel = "Composição",
  formatValue = brl,
  className,
}: StatusDistributionBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  if (total <= 0) return null;

  return (
    <div
      className={cn(
        "rounded-[10px] border border-border bg-card px-5 py-4",
        "shadow-[0_1px_2px_rgba(15,75,80,0.06)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cb-muted">
          {totalLabel}
        </p>
        <p className="text-sm font-bold tabular-nums text-cb-ink">{formatValue(total)}</p>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/50">
        {visible.map((seg) => (
          <div
            key={seg.label}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", seg.colorClass)}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${formatValue(seg.value)}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs text-cb-muted">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", seg.colorClass)} />
            <span className="font-medium text-cb-ink">{seg.label}</span>
            <span className="tabular-nums">{formatValue(seg.value)}</span>
            {total > 0 && (
              <span className="text-[11px] tabular-nums">
                ({Math.round((seg.value / total) * 100)}%)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type TipoBarItem = {
  label: string;
  value: number;
  colorClass: string;
};

export function HorizontalMetricBars({
  title,
  subtitle,
  items,
  formatValue,
  className,
}: {
  title: string;
  subtitle?: string;
  items: TipoBarItem[];
  formatValue?: (n: number) => string;
  className?: string;
}) {
  const fmt = formatValue ?? ((n: number) => String(n));
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={cn("space-y-4", className)}>
      {(title || subtitle) && (
        <div>
          {title && <h3 className="text-sm font-bold text-cb-ink">{title}</h3>}
          {subtitle && <p className="mt-1 text-xs text-cb-muted">{subtitle}</p>}
        </div>
      )}
      <div className="space-y-3.5">
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-cb-ink">{item.label}</span>
              <span className="tabular-nums text-cb-muted">{fmt(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/50">
              <div
                className={cn("h-full rounded-full transition-all", item.colorClass)}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
