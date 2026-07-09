import {
  formatarResumoComparecimento,
  formatarTaxaComparecimento,
} from "@/lib/domain/frequencia";
import type { HistoricoComparecimentoMes } from "@/lib/queries/sessoes";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function taxaClass(taxa: number | null): string {
  if (taxa == null) return "text-muted-foreground";
  if (taxa >= 0.9) return "text-cb-lime font-semibold";
  if (taxa >= 0.75) return "text-cb-orange font-semibold";
  return "text-cb-magenta font-semibold";
}

export function HistoricoComparecimentoTable({
  historico,
  mesSelecionado,
  anoSelecionado,
  onSelectMes,
}: {
  historico: HistoricoComparecimentoMes[];
  mesSelecionado?: number;
  anoSelecionado?: number;
  onSelectMes?: (mes: number, ano: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead>Frequência prevista</TableHead>
            <TableHead className="text-right">Realizadas</TableHead>
            <TableHead className="text-right">Previstas</TableHead>
            <TableHead className="text-right">Comparecimento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historico.map((item) => {
            const selected =
              mesSelecionado === item.mes && anoSelecionado === item.ano;

            return (
              <TableRow
                key={`${item.ano}-${item.mes}`}
                className={cn(
                  onSelectMes && "cursor-pointer hover:bg-muted/40",
                  selected && "bg-cb-cyan-050",
                )}
                onClick={() => onSelectMes?.(item.mes, item.ano)}
              >
              <TableCell className="font-medium capitalize">{item.label}</TableCell>
              <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                {item.metrica.frequenciaLabel ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.metrica.realizadas}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {item.metrica.esperadas ?? "—"}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", taxaClass(item.metrica.taxa))}>
                {formatarResumoComparecimento(item.metrica)}
                {item.metrica.taxa != null && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({formatarTaxaComparecimento(item.metrica.taxa)})
                  </span>
                )}
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
