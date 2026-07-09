import { TipoBadge } from "@/components/domain/TipoBadge";
import { formatarResumoComparecimento } from "@/lib/domain/frequencia";
import type { MetricaComparecimento } from "@/lib/domain/frequencia";
import type { PacienteTipo } from "@/lib/types";
import { cn } from "@/lib/utils";

function progressValue(metrica: MetricaComparecimento): number {
  if (metrica.taxa == null) return 0;
  return Math.round(metrica.taxa * 100);
}

function progressTone(metrica: MetricaComparecimento): string {
  if (metrica.taxa == null) return "bg-muted-foreground/40";
  if (metrica.taxa >= 0.9) return "bg-cb-lime";
  if (metrica.taxa >= 0.75) return "bg-cb-orange";
  return "bg-cb-magenta";
}

export function PacienteComparecimentoCard({
  nome,
  tipo,
  metrica,
  mesLabel,
  showHeader = true,
}: {
  nome?: string;
  tipo?: PacienteTipo;
  metrica: MetricaComparecimento;
  mesLabel: string;
  showHeader?: boolean;
}) {
  const resumo = formatarResumoComparecimento(metrica);
  const pct = progressValue(metrica);

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {showHeader && nome && tipo ? (
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{nome}</h3>
            <TipoBadge value={tipo} />
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comparecimento
            </p>
            <p className="text-sm text-muted-foreground">Frequência prevista × realizadas (P + RC)</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{mesLabel}</p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              metrica.taxa != null && metrica.taxa >= 0.9 && "text-cb-lime",
              metrica.taxa != null && metrica.taxa >= 0.75 && metrica.taxa < 0.9 && "text-cb-orange",
              metrica.taxa != null && metrica.taxa < 0.75 && "text-cb-magenta",
              metrica.taxa == null && "text-foreground",
            )}
          >
            {resumo}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", progressTone(metrica))}
            style={{ width: `${Math.max(pct, metrica.realizadas > 0 ? 4 : 0)}%` }}
          />
        </div>
        {metrica.frequenciaLabel ? (
          <p className="text-[11px] text-muted-foreground">
            Frequência prevista: {metrica.frequenciaLabel}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Sem frequência cadastrada — exibindo apenas realizadas no mês
          </p>
        )}
      </div>
    </article>
  );
}
