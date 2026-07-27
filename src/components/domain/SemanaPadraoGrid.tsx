import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type { FisioDisponibilidade, FisioIndisponibilidade } from "@/lib/queries/fisio-horarios";
import { MOTIVO_INDISP_LABEL } from "@/lib/queries/fisio-horarios";
import type { StatusAgendamento } from "@/lib/types";
import {
  GRADE_SEMANA_PADRAO,
  BLOCOS_COUNT,
  INTERVALOS_COUNT,
  agendamentoNoBloco,
  blocoDentroDisponibilidade,
  indisponibilidadeNoBloco,
  resolverSlotStatus,
  type GradeLinha,
  type SlotStatus,
} from "@/lib/domain/slot-status";

export {
  GRADE_SEMANA_PADRAO,
  BLOCOS_COUNT,
  INTERVALOS_COUNT,
  agendamentoNoBloco,
  blocoDentroDisponibilidade,
  indisponibilidadeNoBloco,
  resolverSlotStatus,
  type GradeLinha,
  type SlotStatus,
};

export const SLOT_STATUS_STYLE: Record<
  SlotStatus,
  { cell: string; text: string; legend: string; label: string }
> = {
  ocupado: {
    cell: "bg-[#E8F8EF]",
    text: "text-[#1B7A45] font-semibold",
    legend: "bg-[#34C759]",
    label: "Ocupado",
  },
  vago: {
    cell: "bg-[#FFF6E0]",
    text: "text-[#C4831A] font-medium lowercase",
    legend: "bg-[#F5C542]",
    label: "Vago",
  },
  indisponivel: {
    cell: "bg-[#FDE8EC]",
    text: "text-[#D11A2A] font-semibold lowercase",
    legend: "bg-[#E85A6B]",
    label: "Indisponível",
  },
  ferias: {
    cell: "bg-[#F0E8FA]",
    text: "text-[#7B4FB5] italic font-medium lowercase",
    legend: "bg-[#9B6DD7]",
    label: "Férias",
  },
  extra: {
    cell: "bg-[#FCE4EC]",
    text: "text-[#C2185B] font-extrabold uppercase tracking-wide",
    legend: "bg-[#E91E8C]",
    label: "Horário extra",
  },
};

export function SlotStatusLegend() {
  const items: SlotStatus[] = ["ocupado", "vago", "indisponivel", "ferias", "extra"];
  return (
    <div className="flex flex-wrap gap-4 text-[11.5px] text-muted-foreground">
      {items.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 font-medium">
          <span
            className={cn("inline-block h-2.5 w-2.5 rounded-full", SLOT_STATUS_STYLE[s].legend)}
          />
          {SLOT_STATUS_STYLE[s].label}
        </span>
      ))}
    </div>
  );
}

export function SlotCellContent({
  status,
  pacienteNome,
  nota,
}: {
  status: SlotStatus;
  pacienteNome?: string;
  nota?: string;
}) {
  if (status === "ocupado") {
    return (
      <span
        className={cn(
          "block truncate text-center text-[11px] leading-tight",
          SLOT_STATUS_STYLE.ocupado.text,
        )}
      >
        {pacienteNome ?? "—"}
        {nota ? <span className="block text-[10px] font-normal opacity-80">{nota}</span> : null}
      </span>
    );
  }
  if (status === "vago") {
    return (
      <span className={cn("block text-center text-[11px] italic", SLOT_STATUS_STYLE.vago.text)}>
        vago
      </span>
    );
  }
  if (status === "indisponivel") {
    return (
      <span className={cn("block text-center text-[11px]", SLOT_STATUS_STYLE.indisponivel.text)}>
        xxx
      </span>
    );
  }
  if (status === "ferias") {
    return (
      <span className={cn("block text-center text-[11px]", SLOT_STATUS_STYLE.ferias.text)}>
        férias
      </span>
    );
  }
  return (
    <span className={cn("block text-center text-[11px]", SLOT_STATUS_STYLE.extra.text)}>EXTRA</span>
  );
}

/** Linha de intervalo: "—" na coluna horário + label centralizado no restante. */
export function IntervaloRow({ label, fisioCount }: { label: string; fisioCount: number }) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center justify-center bg-[#F3F4F6] px-2 py-1.5 text-[11px] text-muted-foreground">
        —
      </div>
      <div
        className="flex items-center justify-center bg-[#F3F4F6] px-3 py-1.5 text-[11px] italic font-medium text-muted-foreground"
        style={{ gridColumn: `2 / span ${fisioCount}` }}
      >
        {label}
      </div>
    </>
  );
}

export function SemanaPadraoGridShell({
  fisios,
  fisioHeaders,
  day,
  diaSemana,
  disponibilidade,
  indisponibilidades,
  getAgendamentos,
  onSlotClick,
  onEmptyClick,
  podeGerir,
}: {
  fisios: { id: string; nome: string }[];
  fisioHeaders: string[];
  day: Date;
  diaSemana: number;
  disponibilidade: FisioDisponibilidade[];
  indisponibilidades: FisioIndisponibilidade[];
  getAgendamentos: (
    fisioId: string,
    blocoInicio: string,
    blocoFim: string,
  ) => Array<{
    id: string;
    status?: StatusAgendamento;
    pacientes?: { nome: string } | null;
    inicio: string;
  }>;
  onSlotClick: (agendamentoId: string) => void;
  onEmptyClick: (fisioId: string, horaInicio: string) => void;
  podeGerir: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className="grid min-w-max gap-px bg-border"
        style={{
          gridTemplateColumns: `72px repeat(${fisios.length}, minmax(100px, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-10 bg-muted/50 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Horário
        </div>
        {fisios.map((f, i) => (
          <div
            key={f.id}
            className="bg-muted/50 px-1.5 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-foreground"
            title={f.nome}
          >
            {fisioHeaders[i]}
          </div>
        ))}

        {GRADE_SEMANA_PADRAO.map((row) => {
          if (row.kind === "intervalo") {
            return (
              <Fragment key={`int-${row.inicio}`}>
                <IntervaloRow label={row.label} fisioCount={fisios.length} />
              </Fragment>
            );
          }

          return (
            <Fragment key={`blk-${row.inicio}`}>
              <div className="sticky left-0 z-10 flex flex-col items-end justify-center bg-card px-2 py-2 text-right text-[10.5px] font-semibold leading-tight tabular-nums text-muted-foreground">
                <span>{row.labelInicio}</span>
                <span>{row.labelFim}</span>
              </div>
              {fisios.map((f) => {
                const items = getAgendamentos(f.id, row.inicio, row.fim);
                const first = items[0];
                const indisp = indisponibilidadeNoBloco(
                  indisponibilidades,
                  day,
                  row.inicio,
                  row.fim,
                  f.id,
                );
                const dentroDisp = blocoDentroDisponibilidade(
                  disponibilidade,
                  f.id,
                  diaSemana,
                  row.inicio,
                  row.fim,
                );
                const status = resolverSlotStatus({
                  agendamentoStatus: first?.status,
                  temAgendamento: items.length > 0,
                  indisp,
                  dentroDisp,
                });
                const isSlotMarker =
                  first?.status === "indisponivel" ||
                  first?.status === "ferias" ||
                  first?.status === "horario_extra";
                const clickable =
                  podeGerir &&
                  (status === "ocupado" ||
                    status === "vago" ||
                    status === "extra" ||
                    status === "indisponivel" ||
                    status === "ferias" ||
                    isSlotMarker);

                return (
                  <button
                    key={`${row.inicio}-${f.id}`}
                    type="button"
                    disabled={!clickable && !first}
                    title={
                      indisp
                        ? `${MOTIVO_INDISP_LABEL[indisp.motivo]}${indisp.observacoes ? ` — ${indisp.observacoes}` : ""}`
                        : undefined
                    }
                    className={cn(
                      "flex min-h-[52px] items-center justify-center px-1.5 py-1.5 transition-colors",
                      SLOT_STATUS_STYLE[status].cell,
                      (clickable || first) && "hover:brightness-[0.97] cursor-pointer",
                      !clickable && !first && "cursor-default",
                    )}
                    onClick={() => {
                      if (first) {
                        onSlotClick(first.id);
                        return;
                      }
                      if ((status === "vago" || status === "extra") && podeGerir) {
                        onEmptyClick(f.id, row.inicio);
                      }
                    }}
                  >
                    <SlotCellContent
                      status={status}
                      pacienteNome={isSlotMarker ? undefined : first?.pacientes?.nome}
                    />
                    {items.length > 1 && !isSlotMarker && (
                      <span className="ml-1 text-[9px] text-muted-foreground">
                        +{items.length - 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
