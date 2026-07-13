import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type { FisioDisponibilidade, FisioIndisponibilidade } from "@/lib/queries/fisio-horarios";
import { MOTIVO_INDISP_LABEL } from "@/lib/queries/fisio-horarios";
import type { StatusAgendamento } from "@/lib/types";

/** Grade visual do mockup: 8 blocos em 4 grupos + 3 intervalos.
 *  Sessão clínica continua 50 min (início = início do bloco); o fim do bloco é a janela visual. */
export type GradeLinha =
  | { kind: "bloco"; inicio: string; fim: string; labelInicio: string; labelFim: string }
  | { kind: "intervalo"; inicio: string; fim: string; label: string };

export const GRADE_SEMANA_PADRAO: GradeLinha[] = [
  { kind: "bloco", inicio: "08:00", fim: "09:25", labelInicio: "08:00", labelFim: "09:25" },
  { kind: "bloco", inicio: "09:30", fim: "10:55", labelInicio: "09:30", labelFim: "10:55" },
  { kind: "intervalo", inicio: "10:55", fim: "11:10", label: "Intervalo · 10:55 — 11:10" },
  { kind: "bloco", inicio: "11:10", fim: "12:25", labelInicio: "11:10", labelFim: "12:25" },
  { kind: "intervalo", inicio: "12:25", fim: "12:40", label: "Intervalo · 12:25 — 12:40" },
  { kind: "bloco", inicio: "12:40", fim: "14:05", labelInicio: "12:40", labelFim: "14:05" },
  { kind: "bloco", inicio: "14:10", fim: "15:35", labelInicio: "14:10", labelFim: "15:35" },
  { kind: "bloco", inicio: "15:40", fim: "17:05", labelInicio: "15:40", labelFim: "17:05" },
  { kind: "intervalo", inicio: "17:05", fim: "17:20", label: "Intervalo · 17:05 — 17:20" },
  { kind: "bloco", inicio: "17:20", fim: "18:45", labelInicio: "17:20", labelFim: "18:45" },
  { kind: "bloco", inicio: "18:50", fim: "20:15", labelInicio: "18:50", labelFim: "20:15" },
];

export const BLOCOS_COUNT = GRADE_SEMANA_PADRAO.filter((r) => r.kind === "bloco").length;
export const INTERVALOS_COUNT = GRADE_SEMANA_PADRAO.filter((r) => r.kind === "intervalo").length;

export type SlotStatus = "ocupado" | "vago" | "indisponivel" | "ferias" | "extra";

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
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", SLOT_STATUS_STYLE[s].legend)} />
          {SLOT_STATUS_STYLE[s].label}
        </span>
      ))}
    </div>
  );
}

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function minutesOnDate(day: Date, hhmm: string) {
  const d = new Date(day);
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function agendamentoNoBloco(
  inicioIso: string,
  blocoInicio: string,
  blocoFim: string,
): boolean {
  const d = new Date(inicioIso);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= timeToMinutes(blocoInicio) && mins < timeToMinutes(blocoFim);
}

export function indisponibilidadeNoBloco(
  items: FisioIndisponibilidade[],
  day: Date,
  blocoInicio: string,
  blocoFim: string,
  fisioterapeutaId: string,
): FisioIndisponibilidade | undefined {
  const start = minutesOnDate(day, blocoInicio);
  const end = minutesOnDate(day, blocoFim);
  return items.find((item) => {
    if (item.fisioterapeuta_id !== fisioterapeutaId) return false;
    const inicio = new Date(item.inicio);
    const fim = new Date(item.fim);
    return inicio < end && fim > start;
  });
}

/** Sem faixas cadastradas = dia aberto. Com faixas = só dentro delas é vago; fora = extra. */
export function blocoDentroDisponibilidade(
  faixas: FisioDisponibilidade[],
  fisioterapeutaId: string,
  diaSemana: number,
  blocoInicio: string,
  blocoFim: string,
): boolean | null {
  const doDia = faixas.filter(
    (f) => f.fisioterapeuta_id === fisioterapeutaId && f.dia_semana === diaSemana && f.ativo,
  );
  if (doDia.length === 0) return null;
  const b0 = timeToMinutes(blocoInicio);
  const b1 = timeToMinutes(blocoFim);
  return doDia.some((f) => {
    const a0 = timeToMinutes(String(f.hora_inicio));
    const a1 = timeToMinutes(String(f.hora_fim));
    return b0 >= a0 && b1 <= a1;
  });
}

export function resolverSlotStatus(opts: {
  agendamentoStatus?: StatusAgendamento | null;
  temAgendamento: boolean;
  indisp?: FisioIndisponibilidade;
  dentroDisp: boolean | null;
}): SlotStatus {
  if (opts.agendamentoStatus === "indisponivel") return "indisponivel";
  if (opts.agendamentoStatus === "ferias") return "ferias";
  if (opts.agendamentoStatus === "horario_extra") return "extra";
  if (opts.temAgendamento) return "ocupado";
  if (opts.indisp?.motivo === "ferias") return "ferias";
  if (opts.indisp) return "indisponivel";
  if (opts.dentroDisp === false) return "extra";
  return "vago";
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
      <span className={cn("block truncate text-center text-[11px] leading-tight", SLOT_STATUS_STYLE.ocupado.text)}>
        {pacienteNome ?? "—"}
        {nota ? <span className="block text-[10px] font-normal opacity-80">{nota}</span> : null}
      </span>
    );
  }
  if (status === "vago") {
    return <span className={cn("block text-center text-[11px] italic", SLOT_STATUS_STYLE.vago.text)}>vago</span>;
  }
  if (status === "indisponivel") {
    return <span className={cn("block text-center text-[11px]", SLOT_STATUS_STYLE.indisponivel.text)}>xxx</span>;
  }
  if (status === "ferias") {
    return <span className={cn("block text-center text-[11px]", SLOT_STATUS_STYLE.ferias.text)}>férias</span>;
  }
  return <span className={cn("block text-center text-[11px]", SLOT_STATUS_STYLE.extra.text)}>EXTRA</span>;
}

/** Linha de intervalo: "—" na coluna horário + label centralizado no restante. */
export function IntervaloRow({
  label,
  fisioCount,
}: {
  label: string;
  fisioCount: number;
}) {
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
  getAgendamentos: (fisioId: string, blocoInicio: string, blocoFim: string) => Array<{
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
