import { useMemo } from "react";

import { cn } from "@/lib/utils";
import type { PacienteTipo, StatusAgendamento } from "@/lib/types";
import { isoToHHMM } from "@/lib/format";

export type AgendaMonthCalendarItem = {
  id: string;
  inicio: string;
  duracao_min: number;
  status: StatusAgendamento;
  pacientes?: { nome: string; tipo: PacienteTipo } | null;
  fisioterapeutas?: { nome: string } | null;
};

const DIAS_GRID = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const TIPO_CHIP: Record<PacienteTipo, string> = {
  particular: "bg-cb-cyan-600/15 text-cb-cyan-900 ring-cb-cyan-600/20",
  judicial: "bg-cb-magenta/15 text-cb-magenta ring-cb-magenta/20",
  convenio: "bg-cb-purple/15 text-cb-purple ring-cb-purple/20",
  puc: "bg-cb-orange/15 text-cb-orange ring-cb-orange/20",
};

const MAX_VISIBLE = 4;

type CalendarCell = {
  date: Date;
  inMonth: boolean;
};

function startWeekdayMonday(year: number, month: number): number {
  const dow = new Date(year, month, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}

function buildMonthCells(year: number, month: number): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const leading = startWeekdayMonday(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  for (let i = leading - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      inMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }

  let trailing = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, trailing), inMonth: false });
    trailing++;
  }

  return cells;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function isDimmedStatus(status: StatusAgendamento): boolean {
  return (
    status === "realizado" ||
    status === "cancelado" ||
    status === "remarcacao" ||
    status === "indisponivel" ||
    status === "ferias"
  );
}

type AgendaMonthCalendarProps = {
  year: number;
  month: number;
  getItems: (day: Date) => AgendaMonthCalendarItem[];
  onSlotClick: (item: AgendaMonthCalendarItem) => void;
  onDayClick?: (day: Date) => void;
  toDateStr: (d: Date) => string;
};

export function AgendaMonthCalendar({
  year,
  month,
  getItems,
  onSlotClick,
  onDayClick,
  toDateStr,
}: AgendaMonthCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const weeks = useMemo(() => {
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-muted/15 to-card shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
            {DIAS_GRID.map((label) => (
              <div
                key={label}
                className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-cb-muted"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="divide-y divide-border/50">
            {weeks.map((week, weekIdx) => (
              <div key={`week-${weekIdx}`} className="grid grid-cols-7 divide-x divide-border/40">
                {week.map((cell) => {
                  const items = getItems(cell.date);
                  const visible = items.slice(0, MAX_VISIBLE);
                  const overflow = items.length - visible.length;
                  const isToday = sameDay(cell.date, today);
                  const weekend = isWeekend(cell.date);

                  return (
                    <div
                      key={toDateStr(cell.date)}
                      className={cn(
                        "flex min-h-[120px] flex-col bg-card/80",
                        !cell.inMonth && "bg-muted/20",
                        weekend && cell.inMonth && "bg-muted/10",
                        isToday && "bg-cb-cyan-050/40 ring-1 ring-inset ring-cb-cyan-300/50",
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex items-center justify-between px-2 py-1.5 text-left transition-colors hover:bg-muted/40",
                          onDayClick && cell.inMonth && "cursor-pointer",
                          !onDayClick && "cursor-default",
                        )}
                        onClick={() => {
                          if (onDayClick && cell.inMonth) onDayClick(cell.date);
                        }}
                      >
                        <span
                          className={cn(
                            "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                            isToday && "bg-cb-cyan-600 text-white",
                            !isToday && cell.inMonth && "text-cb-ink",
                            !cell.inMonth && "text-cb-muted/70",
                          )}
                        >
                          {cell.date.getDate()}
                        </span>
                        {items.length > 0 && (
                          <span className="text-[10px] font-medium tabular-nums text-cb-muted">
                            {items.length}
                          </span>
                        )}
                      </button>

                      <div className="flex flex-1 flex-col gap-1 px-1.5 pb-2">
                        {visible.map((item) => {
                          const tipo = item.pacientes?.tipo ?? "particular";
                          const nome = shortName(item.pacientes?.nome ?? "—");
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onSlotClick(item)}
                              className={cn(
                                "w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] leading-tight ring-1 transition-colors hover:brightness-95",
                                TIPO_CHIP[tipo],
                                isDimmedStatus(item.status) && "opacity-55",
                              )}
                              title={`${isoToHHMM(item.inicio)} ${item.pacientes?.nome ?? ""}`}
                            >
                              <span className="font-bold tabular-nums">
                                {isoToHHMM(item.inicio)}
                              </span>{" "}
                              {nome}
                            </button>
                          );
                        })}
                        {overflow > 0 && (
                          <button
                            type="button"
                            className="rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium text-cb-cyan-700 hover:bg-cb-cyan-050"
                            onClick={() => {
                              if (onDayClick && cell.inMonth) onDayClick(cell.date);
                            }}
                          >
                            +{overflow} mais
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
