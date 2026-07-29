import { DashboardSection } from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { ProntuarioSessoesTab } from "@/components/domain/prontuario/ProntuarioSessoesTab";
import { formatDate } from "@/lib/format";
import type { SessaoProntuario, StatusHistorico } from "@/lib/queries/prontuario";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  historico: StatusHistorico[];
  sessoes: SessaoProntuario[];
  loadingHistorico: boolean;
  loadingSessoes: boolean;
};

export function ProntuarioHistoricoStatusTab({
  historico,
  sessoes,
  loadingHistorico,
  loadingSessoes,
}: Props) {
  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Prontuário"
        accent="orange"
        title="Histórico de status"
        description="Alterações de cadastro e situação do paciente"
        noPadding
      >
        {loadingHistorico ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : historico.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Sem alterações registradas"
              description="Mudanças de status e campos do cadastro aparecerão aqui."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Para</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(h.alterado_em)}
                  </TableCell>
                  <TableCell className="font-medium capitalize">
                    {h.campo.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {h.valor_anterior ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{h.valor_novo ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DashboardSection>

      <ProntuarioSessoesTab sessoes={sessoes} loading={loadingSessoes} />
    </div>
  );
}
