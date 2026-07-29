import type { ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, Mail, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { brl, formatDate, formatPhone } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import {
  emitNfAutomatico,
  prepararEmitFocus,
  sendNfEmail,
  updateNF,
  type NotaFiscal,
} from "@/lib/queries/notas-fiscais";
import { cn } from "@/lib/utils";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function competenciaLabel(mes: number | null, ano: number | null) {
  if (!mes || !ano) return "—";
  return `${MESES[mes - 1]}/${ano}`;
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-cb-muted">{label}</p>
      <div className="text-sm font-medium text-cb-ink">{children}</div>
    </div>
  );
}

type Props = {
  nf: NotaFiscal | null;
  onClose: () => void;
};

export function NotaFiscalDetailSheet({ nf, onClose }: Props) {
  const qc = useQueryClient();
  const open = !!nf;
  const [confirmReemitir, setConfirmReemitir] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);

  const isJudicial = nf?.tipo === "judicial" || nf?.tipo === "puc";
  const podeFocus =
    nf && (nf.status === "erro" || nf.status === "pendente" || nf.status === "processando");

  const focusMutation = useMutation({
    mutationFn: async () => {
      if (!nf) throw new Error("NF não selecionada");
      await prepararEmitFocus(nf);
      return emitNfAutomatico(nf.id);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      if (!nf) return;
      if (result.status === "processando") {
        const detail =
          nf.status === "processando"
            ? `Focus: ${result.focus_status ?? "processando_autorizacao"}`
            : (result.message ?? "Aguardando autorização via webhook.");
        toast.message(nf.status === "processando" ? "Status consultado" : "Reemissão enviada", {
          description: detail,
        });
      } else {
        toast.success("NF atualizada na Focus");
      }
      setConfirmReemitir(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reenviar = useMutation({
    mutationFn: () => {
      if (!nf) throw new Error("NF não selecionada");
      return sendNfEmail(nf.id, nf.tipo);
    },
    onSuccess: () => toast.success("E-mail enfileirado via n8n"),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: () => {
      if (!nf) throw new Error("NF não selecionada");
      return updateNF(nf.id, { status: "cancelada" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      toast.success("NF cancelada");
      setConfirmCancelar(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function runFocus() {
    if (!nf) return;
    if (nf.status === "erro") setConfirmReemitir(true);
    else focusMutation.mutate();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {nf && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  <span>{nf.numero ? `NF ${nf.numero}` : "Nota fiscal"}</span>
                  <StatusBadge kind="nf" value={nf.status} />
                </SheetTitle>
                <SheetDescription>
                  {nf.pacienteNome ?? nf.destinatarioNome ?? "Detalhes da nota fiscal"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="rounded-xl border bg-cb-cyan-050/40 p-4">
                  <p className="text-xs text-cb-muted">Valor da nota</p>
                  <p className="text-2xl font-bold tabular-nums text-cb-ink">{brl(nf.valor)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <TipoBadge value={nf.tipo} />
                    {nf.fiscalProvider && (
                      <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-cb-muted">
                        {nf.fiscalProvider}
                      </span>
                    )}
                  </div>
                </div>

                <section className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="Competência">
                    {competenciaLabel(nf.competenciaMes, nf.competenciaAno)}
                  </DetailField>
                  <DetailField label="Emissão">{formatDate(nf.emissao) || "—"}</DetailField>
                  <DetailField label="Emitida em">{formatDate(nf.emitidaEm) || "—"}</DetailField>
                  <DetailField label="Cadastro">{formatDate(nf.createdAt) || "—"}</DetailField>
                </section>

                <section className="space-y-3 rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-cb-ink">Destinatário (tomador)</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailField label="Nome" className="sm:col-span-2">
                      {nf.destinatarioNome ?? "—"}
                    </DetailField>
                    <DetailField label="CPF/CNPJ">{nf.destinatarioDocumento ?? "—"}</DetailField>
                    <DetailField label="Telefone">
                      {formatPhone(nf.pacienteTelefone) || "—"}
                    </DetailField>
                  </div>
                </section>

                {isJudicial && (
                  <section className="space-y-3 rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold text-cb-ink">
                      Corpo do relatório (judicial)
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailField label="Paciente (corpo)">
                        {nf.corpoPacienteNome ?? "—"}
                      </DetailField>
                      <DetailField label="CPF (corpo)">{nf.corpoPacienteCpf ?? "—"}</DetailField>
                      <DetailField label="Processo" className="sm:col-span-2">
                        {nf.corpoNumeroProcesso ?? "—"}
                      </DetailField>
                      <DetailField label="Dias atendidos">
                        {nf.corpoDiasAtendidos ?? "—"}
                      </DetailField>
                      <DetailField label="Total sessões">
                        {nf.corpoTotalSessoes != null ? String(nf.corpoTotalSessoes) : "—"}
                      </DetailField>
                      <DetailField label="Valor corpo" className="sm:col-span-2">
                        {nf.corpoValorTotal != null ? brl(nf.corpoValorTotal) : "—"}
                      </DetailField>
                    </div>
                  </section>
                )}

                <section className="space-y-3 rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-cb-ink">Vínculos</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailField label="Paciente">
                      {nf.pacienteId ? (
                        <Link
                          to="/app/pacientes/$pacienteId"
                          params={{ pacienteId: nf.pacienteId }}
                          className="text-cb-cyan-700 hover:underline"
                        >
                          {nf.pacienteNome ?? "Ver ficha"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </DetailField>
                    <DetailField label="CPF cadastro">{nf.pacienteCpf ?? "—"}</DetailField>
                    <DetailField label="Cobrança" className="sm:col-span-2">
                      {nf.cobrancaId ? (
                        <span className="font-mono text-xs text-cb-muted">{nf.cobrancaId}</span>
                      ) : (
                        "—"
                      )}
                    </DetailField>
                    <DetailField label="ID da NF" className="sm:col-span-2">
                      <span className="break-all font-mono text-xs text-cb-muted">{nf.id}</span>
                    </DetailField>
                  </div>
                </section>

                {nf.pdfUrl && (
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <a href={nf.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Abrir PDF da nota
                    </a>
                  </Button>
                )}

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {podeFocus && (
                    <Button
                      size="sm"
                      variant={nf.status === "erro" ? "default" : "outline"}
                      disabled={focusMutation.isPending}
                      onClick={runFocus}
                    >
                      <RefreshCw
                        className={`mr-1 h-3.5 w-3.5 ${focusMutation.isPending ? "animate-spin" : ""}`}
                      />
                      {nf.status === "erro"
                        ? "Reemitir Focus"
                        : nf.status === "processando"
                          ? "Consultar Focus"
                          : "Emitir Focus"}
                    </Button>
                  )}
                  {nf.status === "emitida" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reenviar.isPending}
                      onClick={() => reenviar.mutate()}
                    >
                      <Mail className="mr-1 h-3.5 w-3.5" />
                      Reenviar e-mail
                    </Button>
                  )}
                  {nf.pdfUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={nf.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="mr-1 h-3.5 w-3.5" />
                        PDF
                      </a>
                    </Button>
                  )}
                  {nf.status !== "cancelada" && nf.status !== "emitida" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={cancelar.isPending}
                      onClick={() => setConfirmCancelar(true)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Cancelar NF
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmReemitir} onOpenChange={setConfirmReemitir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemitir nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              {nf && (
                <>
                  A NF de <strong>{nf.pacienteNome ?? "paciente"}</strong> ({brl(nf.valor)}) será
                  reenviada à Focus NFe. O status passará para <strong>processando</strong> até o
                  webhook confirmar autorização ou novo erro.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={focusMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={focusMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                focusMutation.mutate();
              }}
            >
              {focusMutation.isPending ? "Enviando…" : "Reemitir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancelar} onOpenChange={setConfirmCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              {nf && (
                <>
                  A NF de <strong>{nf.pacienteNome ?? "paciente"}</strong> ({brl(nf.valor)}) será
                  marcada como <strong>cancelada</strong>. Essa ação não pode ser desfeita pela
                  interface.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelar.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelar.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                cancelar.mutate();
              }}
            >
              {cancelar.isPending ? "Cancelando…" : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
