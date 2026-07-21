import { ExternalLink, FileText, Plus } from "lucide-react";

import { monthPickerLabel } from "@/components/domain/MonthPicker";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { mesLabel } from "@/components/domain/prontuario/constants";
import { Button } from "@/components/ui/button";
import type { RelatorioAtendimento } from "@/lib/queries/prontuario";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  relatorios: RelatorioAtendimento[];
  loading: boolean;
  canEdit: boolean;
  competenciaMes: number;
  competenciaAno: number;
  gerando: boolean;
  onGerar: () => void;
  onFinalizar?: (relatorioId: string) => void;
  finalizandoId?: string | null;
};

export function ProntuarioDocumentosTab({
  relatorios,
  loading,
  canEdit,
  competenciaMes,
  competenciaAno,
  gerando,
  onGerar,
  onFinalizar,
  finalizandoId,
}: Props) {
  const relatoriosCompetencia = relatorios.filter(
    (r) => r.competencia_mes === competenciaMes && r.competencia_ano === competenciaAno,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Documentos</h2>
          <p className="text-xs text-muted-foreground">
            Relatórios de {monthPickerLabel(competenciaMes, competenciaAno)} e laudos gerados
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={onGerar} disabled={gerando} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {gerando ? "Gerando…" : "Gerar relatório"}
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : relatoriosCompetencia.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum documento nesta competência"
          description="Gere um relatório mensal para a competência selecionada no calendário."
        />
      ) : (        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Gerado em</TableHead>
                <TableHead>Assinado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatoriosCompetencia.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{mesLabel(r.competencia_mes, r.competencia_ano)}</TableCell>
                  <TableCell className="capitalize">{r.modelo}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                  <TableCell>{r.assinado ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && onFinalizar && r.pdf_url && !r.assinado && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={finalizandoId === r.id}
                          onClick={() => onFinalizar(r.id)}
                        >
                          {finalizandoId === r.id ? "Enviando…" : "Finalizar / assinar"}
                        </Button>
                      )}
                      {r.pdf_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => window.open(r.pdf_url!, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
