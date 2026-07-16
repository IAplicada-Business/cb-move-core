import { GRADE_SEMANA_PADRAO } from "@/lib/domain/slot-status";
import { isoToHHMM } from "@/lib/format";
import {
  SlotCellContent,
  SLOT_STATUS_STYLE,
  type SlotStatus,
} from "@/components/domain/SemanaPadraoGrid";
import { cn } from "@/lib/utils";

export type PlanoGridRow = {
  id: string;
  inicio: string;
  label: string;
  status: SlotStatus;
  sublabel?: string;
  destacar?: boolean;
  onClick?: () => void;
};

function horaFimBloco(inicioIso: string): string {
  const hora = isoToHHMM(inicioIso);
  const bloco = GRADE_SEMANA_PADRAO.find((r) => r.kind === "bloco" && r.inicio === hora);
  return bloco?.kind === "bloco" ? bloco.labelFim : hora;
}

function PlanoGridRowCell({ row }: { row: PlanoGridRow }) {
  const Tag = row.onClick ? "button" : "div";
  const horaInicio = row.inicio ? isoToHHMM(row.inicio) : "—";
  const horaFim = row.inicio ? horaFimBloco(row.inicio) : "—";

  return (
    <div className="contents">
      <div className="flex flex-col items-end justify-center bg-card px-2 py-2 text-right text-[10.5px] font-semibold tabular-nums text-muted-foreground">
        <span>{horaInicio}</span>
        <span>{horaFim}</span>
      </div>
      <Tag
        type={row.onClick ? "button" : undefined}
        onClick={row.onClick}
        className={cn(
          "flex min-h-[44px] flex-col items-center justify-center px-2 py-1.5 transition-colors",
          SLOT_STATUS_STYLE[row.status].cell,
          row.onClick && "cursor-pointer hover:brightness-[0.97]",
          row.destacar && "ring-2 ring-cb-cyan-600 ring-offset-1",
        )}
      >
        {row.status === "ocupado" ? (
          <SlotCellContent status="ocupado" pacienteNome={row.label} nota={row.sublabel} />
        ) : (
          <span className={cn("text-center text-[11px]", SLOT_STATUS_STYLE[row.status].text)}>
            {row.label}
          </span>
        )}
      </Tag>
    </div>
  );
}

type Props = {
  headerDireita: string;
  rows: PlanoGridRow[];
  maxHeight?: string;
};

export function PlanoSessaoGrid({ headerDireita, rows, maxHeight = "min(280px, 40vh)" }: Props) {
  if (rows.length === 0) return null;

  return (
    <div
      className="overflow-y-auto overflow-x-auto rounded-lg border border-border bg-card"
      style={{ maxHeight }}
    >
      <div className="grid gap-px bg-border" style={{ gridTemplateColumns: "72px 1fr" }}>
        <div className="bg-muted/50 px-2 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">
          Horário
        </div>
        <div className="bg-muted/50 px-2 py-2 text-center text-[10px] font-bold uppercase text-foreground">
          {headerDireita}
        </div>
        {rows.map((row) => (
          <PlanoGridRowCell key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
