import { useMemo } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { DashboardSection, DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { monthPickerLabel } from "@/components/domain/MonthPicker";
import { RelatorioArquivoMenu } from "@/components/domain/RelatorioArquivoMenu";
import { parseFormatoArquivo } from "@/lib/domain/relatorio-renderers";
import { formatDate } from "@/lib/format";
import type { EvolucaoComRelacoes, RelatorioAtendimento } from "@/lib/queries/prontuario";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { buildHistoricoDocumentosAssinados, type HistoricoDocumentoKind } from "./utils";

const KIND_BADGE: Record<HistoricoDocumentoKind, { label: string; className: string }> = {
  evolucao_diaria: {
    label: "Prontuário diário",
    className: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-200",
  },
  relatorio_mensal: {
    label: "Relatório externo",
    className: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  },
  documento_fisico: {
    label: "Documento físico",
    className: "bg-muted text-muted-foreground border-border",
  },
};

type Props = {
  evolucoes: EvolucaoComRelacoes[];
  relatorios: RelatorioAtendimento[];
  loading: boolean;
  competenciaMes: number;
  competenciaAno: number;
  onOpenEvolucao?: () => void;
};

export function ProntuarioHistoricoStatusTab({
  evolucoes,
  relatorios,
  loading,
  competenciaMes,
  competenciaAno,
  onOpenEvolucao,
}: Props) {
  const competenciaLabel = monthPickerLabel(competenciaMes, competenciaAno);

  const rows = useMemo(
    () => buildHistoricoDocumentosAssinados(evolucoes, relatorios, competenciaMes, competenciaAno),
    [evolucoes, relatorios, competenciaMes, competenciaAno],
  );

  if (loading) {
    return <LoadingState label="Carregando histórico de documentos…" />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Nenhum documento assinado nesta competência"
        description={`Em ${competenciaLabel.toLowerCase()} ainda não há evoluções assinadas nem relatórios finalizados. Assine evoluções na aba Evolução diária ou gere relatórios na seção Documentos.`}
        action={
          onOpenEvolucao ? (
            <Button variant="outline" onClick={onOpenEvolucao}>
              Ir para Evolução diária
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Histórico de documentos assinados</h2>
        <p className="text-xs text-muted-foreground">
          Evoluções diárias assinadas pelo fisioterapeuta e relatórios finalizados em{" "}
          {competenciaLabel.toLowerCase()}
        </p>
      </div>

      <DashboardSection
        eyebrow="Prontuário"
        accent="cyan"
        title="Documentos assinados"
        badge={<DashboardSectionBadge accent="cyan">{rows.length}</DashboardSectionBadge>}
        noPadding
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>Assinado em</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const badge = KIND_BADGE[row.kind];
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-foreground">{row.label}</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.referencia}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.assinadoEm)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.assinadoPor ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {row.kind === "evolucao_diaria" && onOpenEvolucao ? (
                        <Button variant="ghost" size="sm" className="h-8" onClick={onOpenEvolucao}>
                          Ver evolução
                        </Button>
                      ) : null}
                      {row.pdfUrl || row.xlsxUrl ? (
                        <RelatorioArquivoMenu
                          pdfUrl={row.pdfUrl}
                          xlsxUrl={row.xlsxUrl}
                          formatoArquivo={parseFormatoArquivo(row.formatoArquivo)}
                          onError={(e) => toast.error(e.message)}
                        />
                      ) : row.kind === "evolucao_diaria" ? (
                        <span className="text-xs text-muted-foreground">In-app</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DashboardSection>
    </div>
  );
}
