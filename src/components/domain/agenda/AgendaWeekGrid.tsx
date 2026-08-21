import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type { PacienteTipo, StatusAgendamento } from "@/lib/types";
import { duracaoSessaoLabel } from "@/lib/domain/slot-status";

type AgendaWeekGridItem = {
  id: string;
  inicio: string;
  duracao_min: number;
  status: StatusAgendamento;
  pacientes?: { nome: string; tipo: PacienteTipo } | null;
  fisioterapeutas?: { nome: string } | null;
};

const TIPO_SLOT: Record<PacienteTipo, string> = {
  particular: "bg-cb-cyan-600/12 ring-cb-cyan-600/25 text-cb-cyan-800",
  judicial: "bg-cb-magenta/12 ring-cb-magenta/25 text-cb-magenta",
  convenio: "bg-cb-purple/12 ring-cb-purple/25 text-cb-purple",
  puc: "bg-cb-orange/12 ring-cb-orange/25 text-cb-orange",
};

function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

type AgendaWeekGridProps = {
  weekDays: Date[];
  dayLabels: string[];
  hours: number[];
  getItems: (day: Date, hour: number) => AgendaWeekGridItem[];
  onSlotClick: (item: AgendaWeekGridItem) => void;
  onEmptyClick: (day: Date, hour: string) => void;
  podeGerir: boolean;
  toDateStr: (d: Date) => string;
  diasPt: string[];
};

export function AgendaWeekGrid({
  weekDays,
  hours,
  getItems,
  onSlotClick,
  onEmptyClick,
  podeGerir,
  toDateStr,
  diasPt,
}: AgendaWeekGridProps) {
  const todayStr = toDateStr(new Date());

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-card shadow-sm">
      <div className="overflow-x-auto p-3">
        <div
          className="grid w-full min-w-0 gap-2"
          style={{ gridTemplateColumns: "56px repeat(5, minmax(0, 1fr))" }}
        >
          <div />
          {weekDays.map((day) => {
            const isToday = toDateStr(day) === todayStr;
            return (
              <div
                key={toDateStr(day)}
                className={cn(
                  "rounded-xl px-2 py-3 text-center",
                  isToday
                    ? "bg-cb-magenta/15 ring-1 ring-cb-magenta/30"
                    : "bg-cb-cyan-050/70 ring-1 ring-cb-cyan-100/80",
                )}
              >
                <span className="block text-[10px] font-bold uppercase tracking-wide text-cb-muted">
                  {diasPt[day.getDay()]}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-lg font-extrabold tabular-nums",
                    isToday ? "text-cb-magenta" : "text-cb-ink",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}

          {hours.map((hour) => (
            <Fragment key={hour}>
              <div className="flex items-start justify-end pr-1 pt-3 text-[11px] font-bold tabular-nums text-cb-muted">
                {String(hour).padStart(2, "0")}:00
              </div>
              {weekDays.map((day) => {
                const items = getItems(day, hour);
                const empty = items.length === 0;
                return (
                  <div
                    key={`${toDateStr(day)}-${hour}`}
                    className={cn(
                      "min-h-[64px] space-y-1 rounded-xl bg-card/90 p-1.5 ring-1 ring-border/50",
                      podeGerir &&
                        empty &&
                        "cursor-pointer hover:bg-cb-cyan-050/50 hover:ring-cb-cyan-200",
                    )}
                    onClick={() => {
                      if (!podeGerir || !empty) return;
                      onEmptyClick(day, `${String(hour).padStart(2, "0")}:00`);
                    }}
                  >
                    {items.map((a) => {
                      const tipo = a.pacientes?.tipo ?? "particular";
                      const dimmed =
                        a.status === "realizado" ||
                        a.status === "cancelado" ||
                        a.status === "faltou";
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSlotClick(a);
                          }}
                          className={cn(
                            "w-full rounded-lg px-2 py-1.5 text-left text-[11px] leading-tight ring-1 transition-all hover:-translate-y-px hover:shadow-sm",
                            TIPO_SLOT[tipo],
                            dimmed && "opacity-55",
                          )}
                        >
                          <span className="block truncate font-bold">
                            {shortName(a.pacientes?.nome ?? "—")}
                          </span>
                          <span className="block truncate opacity-75">
                            {duracaoSessaoLabel(a.duracao_min)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
