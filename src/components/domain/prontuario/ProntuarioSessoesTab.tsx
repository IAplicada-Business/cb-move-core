import { DashboardSection, DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { SIGLA_COLORS } from "@/components/domain/prontuario/constants";
import { formatDate } from "@/lib/format";
import type { SessaoProntuario } from "@/lib/queries/prontuario";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  sessoes: SessaoProntuario[];
  loading: boolean;
};

export function ProntuarioSessoesTab({ sessoes, loading }: Props) {
  if (loading) return <LoadingState />;

  if (sessoes.length === 0) {
    return (
      <EmptyState
        title="Sem sessões"
        description="Nenhuma sessão registrada para este paciente. A frequência é alimentada pela agenda."
      />
    );
  }

  return (
    <DashboardSection
      eyebrow="Prontuário"
      accent="lime"
      title="Histórico de sessões"
      description="Siglas: P presente · F falta · FJ justificada · NJ a recuperar · RC recuperada · NR não realizada"
      noPadding
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Fisio</TableHead>
            <TableHead>Frequência</TableHead>
            <TableHead>Observações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessoes.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{formatDate(s.data)}</TableCell>
              <TableCell className="text-muted-foreground">{s.hora ?? "—"}</TableCell>
              <TableCell>{s.fisioterapeutas?.nome ?? "—"}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                    SIGLA_COLORS[s.sigla],
                  )}
                >
                  {s.sigla}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.observacoes ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DashboardSection>
  );
}
