import { useEffect, useMemo, useState } from "react";
import { AgendaMenuSection } from "@/components/domain/AgendaMenuSection";
import { PlanoSessaoGrid, type PlanoGridRow } from "@/components/domain/PlanoSessaoGrid";
import {
  SITUACAO_SESSAO_LABEL,
  type ItemSessaoMensal,
  type ResumoPlanoSessoesMensal,
  type SituacaoSessaoMensal,
} from "@/lib/domain/plano-sessoes-mensal";
import type { SlotPlanoMensal } from "@/lib/domain/padrao-agenda-mensal";
import { formatDateDDMMYY } from "@/lib/format";
import type { SlotStatus } from "@/lib/domain/slot-status";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const SITUACAO_SLOT: Record<SituacaoSessaoMensal, SlotStatus> = {
  concluida: "ocupado",
  pendente: "ocupado",
  faltou: "indisponivel",
};

type Props = {
  resumo: ResumoPlanoSessoesMensal;
  agendamentoAtualId?: string | null;
  onSessaoClick?: (item: ItemSessaoMensal) => void;
  onFaltanteClick?: (slot: SlotPlanoMensal) => void;
};

function itemParaRow(
  item: ItemSessaoMensal,
  agendamentoAtualId: string | null | undefined,
  onClick?: () => void,
  extra = false,
): PlanoGridRow {
  const numero = item.indicePlano ?? 0;
  return {
    id: item.id,
    inicio: item.inicio,
    label: extra ? `Extra · Sessão ${numero}` : `Sessão ${numero}`,
    sublabel: `${formatDateDDMMYY(item.inicio)} · ${SITUACAO_SESSAO_LABEL[item.situacao]}`,
    status: extra ? "extra" : SITUACAO_SLOT[item.situacao],
    destacar: item.id === agendamentoAtualId,
    onClick,
  };
}

export function PacientePlanoSessoesCard({
  resumo,
  agendamentoAtualId,
  onSessaoClick,
  onFaltanteClick,
}: Props) {
  const mesLabel = `${MESES[resumo.mes - 1] ?? resumo.mes}/${resumo.ano}`;
  const [open, setOpen] = useState(false);

  const faltantesLista =
    resumo.faltantesSlots.length > 0
      ? resumo.faltantesSlots
      : Array.from({ length: resumo.faltantes }, (_, idx) => ({
          indicePlano: resumo.itens.length + idx + 1,
          dataIso: "",
          sessaoNoDia: 1,
        }));

  const rows = useMemo(() => {
    const lista: PlanoGridRow[] = [];

    for (const item of resumo.itens) {
      lista.push(
        itemParaRow(
          item,
          agendamentoAtualId,
          onSessaoClick ? () => onSessaoClick(item) : undefined,
        ),
      );
    }

    for (const slot of faltantesLista) {
      if (!slot.dataIso && resumo.faltantes > 5) continue;
      lista.push({
        id: `faltante-${slot.indicePlano}-${slot.dataIso}`,
        inicio: slot.dataIso ? `${slot.dataIso}T08:00:00-03:00` : "",
        label: "Faltante",
        sublabel: slot.dataIso
          ? `Sessão ${slot.indicePlano} · ${formatDateDDMMYY(slot.dataIso)}`
          : `Sessão ${slot.indicePlano}`,
        status: "vago",
        onClick:
          onFaltanteClick && slot.dataIso
            ? () => onFaltanteClick(slot)
            : undefined,
      });
    }

    for (const item of resumo.extras) {
      lista.push(
        itemParaRow(
          item,
          agendamentoAtualId,
          onSessaoClick ? () => onSessaoClick(item) : undefined,
          true,
        ),
      );
    }

    return lista.sort((a, b) => {
      if (!a.inicio) return 1;
      if (!b.inicio) return -1;
      return a.inicio.localeCompare(b.inicio);
    });
  }, [resumo, agendamentoAtualId, faltantesLista, onSessaoClick, onFaltanteClick]);

  const subtitle = [
    resumo.quantidadeExibicao,
    resumo.frequenciaLabel,
    `${resumo.agendadasNoPlano} no plano`,
    resumo.faltantes > 0 ? `${resumo.faltantes} faltante(s)` : null,
    resumo.extras.length > 0 ? `${resumo.extras.length} extra(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    setOpen(false);
  }, [resumo.mes, resumo.ano, resumo.agendadasNoPlano]);

  return (
    <AgendaMenuSection
      title={`Plano do mês · ${mesLabel}`}
      subtitle={subtitle}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="space-y-3">
        {resumo.diasSemanaLabel && (
          <p className="text-[11px] text-muted-foreground">{resumo.diasSemanaLabel}</p>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-800">
            {resumo.concluidas} concluída{resumo.concluidas === 1 ? "" : "s"}
          </span>
          {resumo.pendentes > 0 && (
            <span className="rounded-full border border-cb-cyan-600/30 bg-cb-cyan-600/10 px-2 py-0.5 text-cb-cyan-900">
              {resumo.pendentes} pendente{resumo.pendentes === 1 ? "" : "s"}
            </span>
          )}
          {resumo.faltas > 0 && (
            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive">
              {resumo.faltas} falta{resumo.faltas === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {(onSessaoClick || onFaltanteClick) && (
          <p className="text-[11px] text-muted-foreground">
            Clique em uma linha para ir ao horário na agenda.
          </p>
        )}

        {rows.length > 0 ? (
          <PlanoSessaoGrid headerDireita={`Plano ${mesLabel}`} rows={rows} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma sessão agendada no plano deste mês.
          </p>
        )}

        {resumo.faltantes > 5 && (
          <p className="text-[11px] text-cb-orange">
            {resumo.faltantes} sessões ainda sem horário no plano.
          </p>
        )}
      </div>
    </AgendaMenuSection>
  );
}
