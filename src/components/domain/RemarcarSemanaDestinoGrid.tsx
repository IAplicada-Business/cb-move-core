import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDateDDMMYY, formatSemanaIntervalo } from "@/lib/format";
import {
  GRADE_SEMANA_PADRAO,
  IntervaloRow,
  SlotCellContent,
  SLOT_STATUS_STYLE,
  type SlotStatus,
} from "@/components/domain/SemanaPadraoGrid";
import {
  listarBlocosDia,
  type SlotRemarcacaoSelecionado,
} from "@/lib/domain/remarcacao-disponibilidade";
import type { FisioDisponibilidade, FisioIndisponibilidade } from "@/lib/queries/fisio-horarios";
import type { StatusAgendamento } from "@/lib/types";

const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex"];

type AgendamentoGrade = {
  id: string;
  fisioterapeuta_id: string | null;
  inicio: string;
  duracao_min: number;
  status?: StatusAgendamento;
  pacientes?: { nome: string } | null;
};

type Props = {
  fisioId: string;
  diasUteis: Date[];
  disponibilidade: FisioDisponibilidade[];
  indisponibilidades: FisioIndisponibilidade[];
  agendamentos: AgendamentoGrade[];
  excluirIds: Set<string>;
  datasPlano?: Set<string>;
  slotSelecionado: SlotRemarcacaoSelecionado | null;
  onPickSlot: (slot: SlotRemarcacaoSelecionado) => void;
  onDaySelect?: (dataIso: string) => void;
};

function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function indexDiaSelecionado(diasUteis: Date[], dataIso: string | undefined): number {
  if (!dataIso) return 0;
  const idx = diasUteis.findIndex((d) => toDateIso(d) === dataIso);
  return idx >= 0 ? idx : 0;
}

export function RemarcarSemanaDestinoGrid({
  fisioId,
  diasUteis,
  disponibilidade,
  indisponibilidades,
  agendamentos,
  excluirIds,
  datasPlano,
  slotSelecionado,
  onPickSlot,
  onDaySelect,
}: Props) {
  const diaIdx = indexDiaSelecionado(diasUteis, slotSelecionado?.dataIso);
  const diaAtivo = diasUteis[diaIdx] ?? diasUteis[0];
  const dataIso = diaAtivo ? toDateIso(diaAtivo) : "";

  const semanaLabel = useMemo(() => {
    if (diasUteis.length < 2) return "";
    return formatSemanaIntervalo(diasUteis[0], diasUteis[diasUteis.length - 1]);
  }, [diasUteis]);

  const blocos = useMemo(() => {
    if (!dataIso) return [];
    return listarBlocosDia({
      fisioId,
      dataIso,
      disponibilidade,
      indisponibilidades,
      agendamentos,
      excluirIds,
    });
  }, [fisioId, dataIso, disponibilidade, indisponibilidades, agendamentos, excluirIds]);

  const vagosDiaAtivo = useMemo(() => blocos.filter((b) => b.selecionavel).length, [blocos]);

  return (
    <div className="space-y-2">
      {semanaLabel && (
        <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground">
          Semana {semanaLabel}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Horários na semana destino — clique em um slot vago
      </p>

      <div className="flex flex-wrap gap-1">
        {diasUteis.map((day, idx) => {
          const iso = toDateIso(day);
          const noPlano = datasPlano?.has(iso);
          const abaAtiva = diaIdx === idx;
          const diaSelecionado = slotSelecionado?.dataIso === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDaySelect?.(iso)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                abaAtiva
                  ? "border-cb-cyan-600 bg-cb-cyan-600/10 text-cb-cyan-900"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                diaSelecionado && !abaAtiva && "ring-1 ring-cb-cyan-600/50",
                noPlano && "ring-1 ring-cb-cyan-600/30",
              )}
            >
              {DIAS_LABEL[idx]} {formatDateDDMMYY(iso)}
              {abaAtiva && vagosDiaAtivo > 0 && (
                <span className="ml-1 text-[10px] text-cb-orange">
                  ({vagosDiaAtivo} vago{vagosDiaAtivo !== 1 ? "s" : ""})
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-h-[min(280px,38vh)] overflow-y-auto overflow-x-auto rounded-lg border border-border bg-card">
        <div className="grid gap-px bg-border" style={{ gridTemplateColumns: "72px 1fr" }}>
          <div className="bg-muted/50 px-2 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">
            Horário
          </div>
          <div className="bg-muted/50 px-2 py-2 text-center text-[10px] font-bold uppercase text-foreground">
            {DIAS_LABEL[diaIdx]} {dataIso ? formatDateDDMMYY(dataIso) : ""}
          </div>

          {GRADE_SEMANA_PADRAO.map((row) => {
            if (row.kind === "intervalo") {
              return <IntervaloRow key={`int-${row.inicio}`} label={row.label} fisioCount={1} />;
            }

            const bloco = blocos.find((b) => b.horaInicio === row.inicio);
            const status: SlotStatus = bloco?.status ?? "vago";
            const selecionado =
              slotSelecionado?.dataIso === dataIso && slotSelecionado.horaInicio === row.inicio;

            return (
              <div key={`blk-${row.inicio}`} className="contents">
                <div className="flex flex-col items-end justify-center bg-card px-2 py-2 text-right text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                  <span>{row.labelInicio}</span>
                  <span>{row.labelFim}</span>
                </div>
                <button
                  type="button"
                  disabled={!bloco?.selecionavel}
                  title={bloco?.motivoIndisponivel}
                  onClick={() => {
                    if (!bloco?.selecionavel || !dataIso) return;
                    onPickSlot({ dataIso, horaInicio: row.inicio });
                  }}
                  className={cn(
                    "flex min-h-[44px] items-center justify-center px-2 py-1.5 transition-colors",
                    SLOT_STATUS_STYLE[status].cell,
                    bloco?.selecionavel && "cursor-pointer hover:brightness-[0.97]",
                    !bloco?.selecionavel && "cursor-not-allowed opacity-90",
                    selecionado && "ring-2 ring-cb-cyan-600 ring-offset-1",
                  )}
                >
                  <SlotCellContent status={status} pacienteNome={bloco?.pacienteNome} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {(["vago", "ocupado", "indisponivel"] as SlotStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span
              className={cn("inline-block h-2 w-2 rounded-full", SLOT_STATUS_STYLE[s].legend)}
            />
            {SLOT_STATUS_STYLE[s].label}
          </span>
        ))}
        {datasPlano && datasPlano.size > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full ring-1 ring-cb-cyan-600/50" />
            Dia do plano
          </span>
        )}
      </div>
    </div>
  );
}
