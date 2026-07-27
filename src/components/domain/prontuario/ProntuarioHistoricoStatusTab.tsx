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
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Histórico de status</h2>
          <p className="text-xs text-muted-foreground">
            Alterações de cadastro e situação do paciente
          </p>
        </div>

        {loadingHistorico ? (
          <LoadingState />
        ) : historico.length === 0 ? (
          <EmptyState
            title="Sem alterações registradas"
            description="Mudanças de status e campos do cadastro aparecerão aqui."
          />
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
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
          </div>
        )}
      </div>

      <ProntuarioSessoesTab sessoes={sessoes} loading={loadingSessoes} />
    </div>
  );
}
