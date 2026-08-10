import { cn } from "@/lib/utils";
import { formatDateDDMMYY } from "@/lib/format";

type AgendaDayStripProps = {
  days: Date[];
  labels: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  className?: string;
};

function isToday(d: Date) {
  const t = new Date();
  return (
    d.getDate() === t.getDate() &&
    d.getMonth() === t.getMonth() &&
    d.getFullYear() === t.getFullYear()
  );
}

export function AgendaDayStrip({
  days,
  labels,
  selectedIdx,
  onSelect,
  className,
}: AgendaDayStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-gradient-to-r from-cb-cyan-050/50 via-background to-background p-2 shadow-sm",
        className,
      )}
    >
      {days.map((day, i) => {
        const selected = selectedIdx === i;
        const today = isToday(day);
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "relative min-w-[96px] flex-1 rounded-xl px-3 py-2.5 text-center transition-all sm:min-w-[108px] sm:flex-none",
              selected
                ? "bg-cb-cyan-600 text-white shadow-md shadow-cb-cyan-600/25 ring-2 ring-cb-cyan-600/20"
                : today
                  ? "bg-cb-magenta/10 text-cb-magenta ring-1 ring-cb-magenta/30 hover:bg-cb-magenta/15"
                  : "bg-card/80 text-cb-muted ring-1 ring-border/60 hover:bg-card hover:text-cb-ink",
            )}
          >
            <span
              className={cn(
                "block text-[10px] font-bold uppercase tracking-[0.14em]",
                selected ? "text-white/90" : today ? "text-cb-magenta" : "text-cb-muted",
              )}
            >
              {labels[i]}
            </span>
            <span
              className={cn(
                "mt-0.5 block text-sm font-extrabold tabular-nums",
                selected ? "text-white" : "text-cb-ink",
              )}
            >
              {formatDateDDMMYY(day)}
            </span>
            {today && !selected && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cb-magenta ring-2 ring-background" />
            )}
          </button>
        );
      })}
    </div>
  );
}
