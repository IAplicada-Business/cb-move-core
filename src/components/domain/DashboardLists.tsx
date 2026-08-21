import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/domain/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { StatusAgendamento } from "@/lib/types";

type AgendaItem = {
  id: string;
  inicio: string;
  pacienteNome: string;
  fisioNome?: string;
  status: StatusAgendamento;
};

function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
    date: d.getDate(),
    month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function AgendaPreviewList({
  items,
  showFisio,
  className,
}: {
  items: AgendaItem[];
  showFisio?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border", className)}>
      {items.map((a) => {
        const parts = dateParts(a.inicio);
        return (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-4 px-1 py-4 transition-colors hover:bg-cb-cyan-050/40 sm:px-2"
          >
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-cb-cyan-050 text-cb-cyan-800 ring-1 ring-cb-cyan-100">
              <span className="text-[10px] font-bold uppercase leading-none">{parts.day}</span>
              <span className="text-xl font-extrabold leading-none tabular-nums">{parts.date}</span>
              <span className="text-[9px] font-semibold uppercase leading-none opacity-80">
                {parts.month}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-cb-ink">{a.pacienteNome}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-cb-muted">
                <CalendarClock className="h-3.5 w-3.5" />
                {parts.time}
                {showFisio && a.fisioNome && (
                  <>
                    <span aria-hidden>·</span>
                    {a.fisioNome}
                  </>
                )}
              </p>
            </div>

            <StatusBadge kind="agenda" value={a.status} />
          </div>
        );
      })}
    </div>
  );
}

type DivergenciaItem = {
  pacienteId: string;
  pacienteNome: string;
  data: string;
};

const DIVERGENCIA_PREVIEW_LIMIT = 5;

export function DivergenciaPreviewList({ items }: { items: DivergenciaItem[] }) {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? items : items.slice(0, DIVERGENCIA_PREVIEW_LIMIT);
  const restantes = items.length - visiveis.length;

  return (
    <div className="space-y-2">
      {visiveis.map((d) => {
        const label = new Date(`${d.data}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });

        return (
          <div
            key={`${d.pacienteId}_${d.data}`}
            className="flex items-center gap-3 rounded-xl border border-[#FDE68A]/80 bg-[#FFFBEB]/60 p-4"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold uppercase text-[#92400E] ring-1 ring-[#FDE68A]">
              {label}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-cb-ink">{d.pacienteNome}</p>
              <p className="text-xs text-[#92400E]">Sem evolução no prontuário</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs" asChild>
              <Link to="/app/prontuario/$pacienteId" params={{ pacienteId: d.pacienteId }}>
                Abrir
              </Link>
            </Button>
          </div>
        );
      })}
      {restantes > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpandido(true)}
        >
          Ver mais {restantes}
        </Button>
      )}
    </div>
  );
}

export function PacienteTipoDistribution({
  total,
  particular,
  convenio,
  judicial,
  puc = 0,
}: {
  total: number;
  particular: number;
  convenio: number;
  judicial: number;
  puc?: number;
}) {
  if (total <= 0) return null;

  const slices = [
    { label: "Particular", value: particular, color: "bg-cb-cyan-600" },
    { label: "Convênio", value: convenio, color: "bg-cb-purple" },
    { label: "Judicial", value: judicial, color: "bg-cb-magenta" },
    ...(puc > 0 ? [{ label: "PUC", value: puc, color: "bg-cb-orange" }] : []),
  ].filter((s) => s.value > 0);

  return (
    <div className="cb-glass-card px-5 py-4 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cb-muted">
        Distribuição por tipo
      </p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted/50">
        {slices.map((s) => (
          <div
            key={s.label}
            className={cn("h-full", s.color)}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={cn("h-2 w-2 rounded-full", s.color)} />
            <span className="text-cb-muted">{s.label}</span>
            <span className="font-semibold tabular-nums text-cb-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
