import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { monthPickerLabel } from "@/components/domain/MonthPicker";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { RelatorioArquivoMenu } from "@/components/domain/RelatorioArquivoMenu";
import { mesLabel } from "@/components/domain/prontuario/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { openRelatorioArquivo } from "@/lib/relatorio-pdf-url";
import { can } from "@/lib/permissions";
import {
  deleteRelatorioAtendimento,
  removeRelatorioAtendimentoPdf,
  uploadRelatorioAtendimentoPdf,
  type RelatorioAtendimento,
} from "@/lib/queries/prontuario";
import { queryKeys } from "@/lib/queries/keys";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  pacienteId: string;
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
  pacienteId,
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
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canDelete = can.deleteRelatorioAtendimento(roles);
  const canRemovePdf = can.removeRelatorioAtendimentoPdf(roles);
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [deleting, setDeleting] = React.useState<RelatorioAtendimento | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);

  const relatoriosCompetencia = relatorios.filter(
    (r) => r.competencia_mes === competenciaMes && r.competencia_ano === competenciaAno,
  );
  const relatorioFisico = relatoriosCompetencia.find((r) => r.modelo_pdf === "documento_fisico");
  const relatoriosDigitais = relatoriosCompetencia.filter(
    (r) => r.modelo_pdf !== "documento_fisico",
  );

  const uploadPdfMutation = useMutation({
    mutationFn: () => {
      if (!pdfFile) throw new Error("Selecione um arquivo PDF.");
      return uploadRelatorioAtendimentoPdf(pacienteId, competenciaMes, competenciaAno, pdfFile);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.relatorios(pacienteId) });
      setPdfFile(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      toast.success("Relatório de atendimento importado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePdfMutation = useMutation({
    mutationFn: () => {
      if (!relatorioFisico) throw new Error("Nenhum documento físico para remover.");
      return removeRelatorioAtendimentoPdf(
        relatorioFisico.id,
        pacienteId,
        competenciaMes,
        competenciaAno,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.relatorios(pacienteId) });
      toast.success("PDF do relatório removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (relatorio: RelatorioAtendimento) =>
      deleteRelatorioAtendimento(relatorio, pacienteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.relatorios(pacienteId) });
      setDeleting(null);
      toast.success("Relatório excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function renderDeleteButton(relatorio: RelatorioAtendimento) {
    if (!canDelete) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-destructive hover:text-destructive"
        disabled={deleteMutation.isPending}
        onClick={() => setDeleting(relatorio)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Excluir</span>
      </Button>
    );
  }

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

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Relatório de Atendimento (documento físico)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Importe o scan assinado em papel do relatório mensal de{" "}
            {monthPickerLabel(competenciaMes, competenciaAno).toLowerCase()}. Um arquivo por
            competência — ao importar novamente, o anterior é substituído.
          </p>
        </div>
        {relatorioFisico?.pdf_url ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Documento importado</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void openRelatorioArquivo(relatorioFisico.pdf_url).catch((e: Error) =>
                  toast.error(e.message),
                );
              }}
            >
              <ExternalLink className="mr-1 h-4 w-4" /> Abrir PDF
            </Button>
            {canRemovePdf && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePdfMutation.mutate()}
                disabled={removePdfMutation.isPending}
              >
                Remover PDF
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleting(relatorioFisico)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        ) : relatorioFisico ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Registro do documento físico criado — aguardando importação do PDF.
            </p>
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleting(relatorioFisico)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum relatório físico importado nesta competência.
          </p>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="relatorio-atendimento-pdf-input" className="sr-only">
                Arquivo PDF
              </Label>
              <Input
                id="relatorio-atendimento-pdf-input"
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={() => uploadPdfMutation.mutate()}
              disabled={!pdfFile || uploadPdfMutation.isPending}
            >
              <Upload className="mr-1 h-4 w-4" />
              {uploadPdfMutation.isPending ? "Importando…" : "Importar PDF"}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : relatoriosDigitais.length === 0 ? (
        relatorioFisico ? null : (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Nenhum relatório digital nesta competência"
            description="Gere um relatório mensal ou importe o scan do relatório de atendimento assinado em papel."
          />
        )
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
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
              {relatoriosDigitais.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {mesLabel(r.competencia_mes, r.competencia_ano)}
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">{r.modelo}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.created_at)}
                  </TableCell>
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
                      {r.pdf_url || r.xlsx_url ? (
                        <RelatorioArquivoMenu
                          pdfUrl={r.pdf_url}
                          xlsxUrl={r.xlsx_url}
                          formatoArquivo={r.formato_arquivo}
                          onError={(e) => toast.error(e.message)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {renderDeleteButton(r)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {relatorioFisico && (
                <TableRow key={relatorioFisico.id}>
                  <TableCell className="font-medium">
                    {mesLabel(relatorioFisico.competencia_mes, relatorioFisico.competencia_ano)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">Documento físico</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(relatorioFisico.created_at)}
                  </TableCell>
                  <TableCell>{relatorioFisico.assinado ? "Assinado (papel)" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {relatorioFisico.pdf_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => {
                            void openRelatorioArquivo(relatorioFisico.pdf_url).catch((e: Error) =>
                              toast.error(e.message),
                            );
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Use importação acima</span>
                      )}
                      {renderDeleteButton(relatorioFisico)}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o relatório de{" "}
              <strong>
                {deleting ? mesLabel(deleting.competencia_mes, deleting.competencia_ano) : ""}
              </strong>
              ? O PDF associado também será removido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting);
              }}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
