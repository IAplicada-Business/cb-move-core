import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateDDMMYY, parseDDMMYYToISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const DIAS_GRID = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function ddmmyyToDate(value: string): Date | null {
  const iso = parseDDMMYYToISO(value);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startWeekday(year: number, month: number) {
  const dow = new Date(year, month, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const cells: (Date | null)[] = [];
  const leading = startWeekday(year, month);
  const total = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

type DateInputDDMMYYProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function DateInputDDMMYY({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "dd/mm/aa",
  disabled,
}: DateInputDDMMYYProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const selected = useMemo(() => ddmmyyToDate(value), [value]);

  const [view, setView] = useState(() => {
    const base = selected ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const base = selected ?? today;
    setView({ year: base.getFullYear(), month: base.getMonth() });
  }, [open, selected, today]);

  const grid = useMemo(() => buildCalendarGrid(view.year, view.month), [view.year, view.month]);

  function selectDay(day: Date) {
    onChange(formatDateDDMMYY(day));
    setOpen(false);
  }

  function prevMonth() {
    setView((v) => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { ...v, month: v.month - 1 };
    });
  }

  function nextMonth() {
    setView((v) => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { ...v, month: v.month + 1 };
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onClick={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          inputMode="numeric"
          disabled={disabled}
          className="pr-9"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 top-0 h-full w-9 rounded-l-none text-muted-foreground hover:text-foreground"
            aria-label="Abrir calendário"
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent className="z-[100] w-auto p-3" align="start">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold">
            {MESES[view.month]} {view.year}
          </p>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {DIAS_GRID.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((day, i) =>
            day ? (
              <button
                key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}-${i}`}
                type="button"
                onClick={() => selectDay(day)}
                className={cn(
                  "h-8 w-8 rounded-md text-sm transition-colors hover:bg-accent",
                  selected &&
                    sameDay(day, selected) &&
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  !selected && sameDay(day, today) && "border border-primary/40",
                )}
              >
                {day.getDate()}
              </button>
            ) : (
              <span key={`empty-${i}`} className="h-8 w-8" />
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
