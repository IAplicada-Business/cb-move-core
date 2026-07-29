import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  Send,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/domain/StatusBadge";
import { LoadingState } from "@/components/domain/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { brl, formatDate } from "@/lib/format";
import {
  agregarCobrancasPorPaciente,
  type PacienteCobrancaResumo,
  type StatusResumo,
} from "@/lib/domain/cobrancas-por-paciente";
import {
  BoletoEnvioNaoConfiguradoError,
  CoraNaoConfiguradaError,
  enviarBoletoCobranca,
  gerarBoletoCora,
  validarEmitBoletoCoraLocal,
} from "@/lib/queries/boleto-cora";
import { fetchCobrancas, updateCobranca, type Cobranca } from "@/lib/queries/cobrancas";
import { fetchCobrancaNfResumo } from "@/lib/queries/notas-fiscais";
import { queryKeys } from "@/lib/queries";
import type { CobrancaStatus, FormaPagamento } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CobrancaNfFluxoBadge,
  CobrancaNfFluxoChip,
} from "@/components/domain/CobrancaNfFluxoBadge";
import { resolverNfFluxoStatus, podeMarcarComoPago } from "@/lib/domain/cobranca-nf-fluxo";

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function mesAbrev(mes: number | null, ano: number | null) {
  if (!mes || !ano) return "—";
  return `${MESES_ABREV[mes - 1]}/${ano}`;
}

function formaPgtoLabel(f: FormaPagamento | null) {
  if (!f) return "—";
  const map: Record<FormaPagamento, string> = {
    boleto: "Boleto",
    deposito: "Depósito",
    transferencia: "PIX / transferência",
    alvara_judicial: "Alvará judicial",
    convenio_direto: "Convênio direto",
  };
  return map[f] ?? f;
}

function StatusResumoBadge({ value }: { value: StatusResumo }) {
  if (value === "parcial") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
          "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
        )}
      >
        Parcial
      </span>
    );
  }
  return <StatusBadge value={value as CobrancaStatus} />;
}

function cobrancaAtiva(c: Cobranca) {
  return c.status !== "pago" && c.status !== "cancelado";
}

function podeGerarBoleto(c: Cobranca) {
  return cobrancaAtiva(c) && !c.boletoUrl;
}

function podeEnviarBoletoPaciente(c: Cobranca) {
  return cobrancaAtiva(c) && Boolean(c.boletoUrl);
}

const FORMAS_PARCELAVEIS: FormaPagamento[] = ["deposito", "transferencia", "alvara_judicial"];

function podeParcelar(c: Cobranca) {
  return (
    cobrancaAtiva(c) &&
    !c.parcelamentoGrupoId &&
    FORMAS_PARCELAVEIS.includes(c.formaPagamento as FormaPagamento)
  );
}

type Props = {
  pacienteId: string | null;
  pacienteNome?: string | null;
  onClose: () => void;
  onMarcarPago: (c: Cobranca) => void;
  onParcelar: (c: Cobranca) => void;
};

export function PacienteCobrancaSheet({
  pacienteId,
  pacienteNome,
  onClose,
  onMarcarPago,
  onParcelar,
}: Props) {
  const qc = useQueryClient();
  const open = !!pacienteId;
  const [verCanceladas, setVerCanceladas] = useState(false);

  const histQuery = useQuery({
    queryKey: queryKeys.cobrancas.list({ pacienteId: pacienteId ?? "" }),
    queryFn: () => fetchCobrancas({ pacienteId: pacienteId! }),
    enabled: open,
  });

  const cobrancasAtivas = useMemo(
    () => (histQuery.data ?? []).filter((c) => c.status !== "cancelado"),
    [histQuery.data],
  );
  const cobrancaIds = useMemo(() => cobrancasAtivas.map((c) => c.id), [cobrancasAtivas]);
  const nfResumoQuery = useQuery({
    queryKey: ["notas_fiscais", "cobrancaResumo", cobrancaIds],
    queryFn: () => fetchCobrancaNfResumo(cobrancaIds),
    enabled: open && cobrancaIds.length > 0,
  });
  const nfPorCobranca = nfResumoQuery.data ?? new Map();

  const resumo: PacienteCobrancaResumo | null = histQuery.data
    ? (agregarCobrancasPorPaciente(histQuery.data)[0] ?? null)
    : null;

  const cobrancasHistorico = useMemo(
    () => resumo?.cobrancas.filter((c) => c.status !== "cancelado") ?? [],
    [resumo],
  );
  const cobrancasCanceladas = useMemo(
    () => resumo?.cobrancas.filter((c) => c.status === "cancelado") ?? [],
    [resumo],
  );

  const gerarBoleto = useMutation({
    mutationFn: (cobrancaId: string) => gerarBoletoCora(cobrancaId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      qc.invalidateQueries({ queryKey: ["financeiro", "kpis"] });
      if (res.boletoUrl && res.pixEmv) {
        toast.success("Boleto e PIX gerados pela Cora");
      } else if (res.boletoUrl) {
        toast.success("Boleto gerado pela Cora");
      } else if (res.pixEmv) {
        toast.success("PIX gerado pela Cora");
      } else {
        toast.success("Solicitação enviada à Cora");
      }
    },
    onError: (e: Error) => {
      if (e instanceof CoraNaoConfiguradaError) {
        toast.error(e.message, {
          description: "Quando as credenciais forem aplicadas no servidor, tente de novo.",
        });
        return;
      }
      toast.error(e.message || "Falha ao gerar boleto");
    },
  });

  const enviarBoleto = useMutation({
    mutationFn: (cobrancaId: string) => enviarBoletoCobranca(cobrancaId),
    onSuccess: (res) => {
      if (res.duplicate) {
        toast.info("Esta cobrança já foi enfileirada para envio");
        return;
      }
      toast.success("Solicitação enviada à automação (n8n)");
    },
    onError: (e: Error) => {
      if (e instanceof BoletoEnvioNaoConfiguradoError) {
        toast.error(e.message, {
          description: "O workflow n8n de documentos será configurado na próxima etapa.",
        });
        return;
      }
      toast.error(e.message || "Falha ao enviar boleto");
    },
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => updateCobranca(id, { status: "cancelado" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      toast.success("Cobrança cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copiarTexto(texto: string, label = "Texto copiado") {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(label);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const nome = resumo?.pacienteNome ?? pacienteNome ?? "Paciente";
  const pacienteCpf = resumo?.cobrancas[0]?.pacienteCpf ?? histQuery.data?.[0]?.pacienteCpf ?? null;
  const pacienteEmail =
    resumo?.cobrancas[0]?.pacienteEmail ?? histQuery.data?.[0]?.pacienteEmail ?? null;
  const faltaCadastroPaciente = !pacienteCpf?.replace(/\D/g, "") || !pacienteEmail?.trim();

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{nome}</SheetTitle>
          <SheetDescription>Histórico financeiro e cobranças do cliente</SheetDescription>
        </SheetHeader>

        {histQuery.isLoading ? (
          <div className="mt-6">
            <LoadingState />
          </div>
        ) : histQuery.isError ? (
          <p className="mt-6 text-sm text-destructive">
            {(histQuery.error as Error)?.message ?? "Erro ao carregar cobranças"}
          </p>
        ) : !resumo ? (
          <p className="mt-6 text-sm text-muted-foreground">Nenhuma cobrança para este paciente.</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total do cliente</p>
                  <p className="text-2xl font-bold tabular-nums">{brl(resumo.totalValor)}</p>
                </div>
                <StatusResumoBadge value={resumo.statusResumo} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium tabular-nums">{resumo.progressoLabel}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-cb-cyan-600 transition-all"
                  style={{
                    width: resumo.qtdTotal
                      ? `${Math.round((resumo.qtdPagas / resumo.qtdTotal) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>

            {faltaCadastroPaciente && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Para gerar boleto Cora, cadastre{" "}
                {!pacienteCpf?.replace(/\D/g, "") ? "CPF/CNPJ" : null}
                {!pacienteCpf?.replace(/\D/g, "") && !pacienteEmail?.trim() ? " e " : null}
                {!pacienteEmail?.trim() ? "e-mail" : null} do paciente em <strong>Pacientes</strong>
                .
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">Histórico de cobranças</h3>
              <Accordion type="multiple" className="w-full">
                {cobrancasHistorico.map((c) => {
                  const nfFluxo = resolverNfFluxoStatus(c, nfPorCobranca.get(c.id)?.status);
                  const podePagar = podeMarcarComoPago(nfFluxo);
                  return (
                    <AccordionItem key={c.id} value={c.id}>
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                          <div className="text-left">
                            <p className="text-sm font-medium">
                              {mesAbrev(c.competenciaMes, c.competenciaAno)}
                              {c.parcelaNumero && c.parcelaTotal && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  (parcela {c.parcelaNumero}/{c.parcelaTotal})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {brl(c.valor)} · {formaPgtoLabel(c.formaPagamento)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge value={c.status} />
                            <CobrancaNfFluxoChip fluxo={nfFluxo} />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pb-2 text-sm">
                          <CobrancaNfFluxoBadge fluxo={nfFluxo} />
                          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                            <span>Vencimento</span>
                            <span className="text-right text-foreground">
                              {formatDate(c.vencimento)}
                            </span>
                            <span>Pago em</span>
                            <span className="text-right text-foreground">
                              {formatDate(c.pagoEm)}
                            </span>
                            <span>Serviço</span>
                            <span className="text-right text-foreground">{c.servico ?? "—"}</span>
                          </div>

                          {c.boletoUrl && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(c.boletoUrl!, "_blank", "noopener,noreferrer")
                                }
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Abrir boleto
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copiarTexto(c.boletoUrl!, "Link do boleto copiado")}
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Copiar link
                              </Button>
                            </div>
                          )}

                          {c.pixEmv && (
                            <div className="rounded-md border border-cb-cyan-200 bg-cb-cyan-50/50 p-3 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-cb-cyan-900">
                                <QrCode className="h-3.5 w-3.5" />
                                PIX Copia e Cola
                              </div>
                              <p className="text-[11px] font-mono break-all text-muted-foreground line-clamp-4">
                                {c.pixEmv}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-cb-cyan-300 bg-white"
                                onClick={() => copiarTexto(c.pixEmv!, "Código PIX copiado")}
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Copiar código PIX
                              </Button>
                            </div>
                          )}

                          {podeGerarBoleto(c) &&
                            (() => {
                              const bloqueio = validarEmitBoletoCoraLocal({
                                pacienteCpf: c.pacienteCpf ?? pacienteCpf,
                                pacienteEmail: c.pacienteEmail ?? pacienteEmail,
                                vencimento: c.vencimento,
                                valor: c.valor,
                              });
                              return bloqueio ? (
                                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                                  {bloqueio}
                                </p>
                              ) : null;
                            })()}

                          <div className="flex flex-wrap gap-2 pt-1">
                            {podeGerarBoleto(c) && (
                              <Button
                                size="sm"
                                disabled={gerarBoleto.isPending}
                                onClick={() => {
                                  const bloqueio = validarEmitBoletoCoraLocal({
                                    pacienteCpf: c.pacienteCpf ?? pacienteCpf,
                                    pacienteEmail: c.pacienteEmail ?? pacienteEmail,
                                    vencimento: c.vencimento,
                                    valor: c.valor,
                                  });
                                  if (bloqueio) {
                                    toast.error(bloqueio);
                                    return;
                                  }
                                  gerarBoleto.mutate(c.id);
                                }}
                              >
                                {gerarBoleto.isPending && gerarBoleto.variables === c.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                )}
                                Gerar boleto
                              </Button>
                            )}
                            {podeEnviarBoletoPaciente(c) && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={enviarBoleto.isPending}
                                onClick={() => enviarBoleto.mutate(c.id)}
                              >
                                {enviarBoleto.isPending && enviarBoleto.variables === c.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5 mr-1" />
                                )}
                                Enviar boleto
                              </Button>
                            )}
                            {c.status !== "pago" && c.status !== "cancelado" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!podePagar}
                                title={
                                  !podePagar
                                    ? "Emita a NF antes de registrar o pagamento"
                                    : undefined
                                }
                                onClick={() => onMarcarPago(c)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Marcar pago
                              </Button>
                            )}
                            {podeParcelar(c) && (
                              <Button size="sm" variant="outline" onClick={() => onParcelar(c)}>
                                <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1" />
                                Parcelar
                              </Button>
                            )}
                            {c.status !== "cancelado" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                disabled={cancelar.isPending}
                                onClick={() => cancelar.mutate(c.id)}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
              {cobrancasCanceladas.length > 0 && (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={() => setVerCanceladas((v) => !v)}
                  >
                    {verCanceladas ? "Ocultar" : "Ver"} canceladas ({cobrancasCanceladas.length})
                  </Button>
                  {verCanceladas && (
                    <Accordion type="multiple" className="w-full mt-1 opacity-70">
                      {cobrancasCanceladas.map((c) => (
                        <AccordionItem key={c.id} value={c.id}>
                          <AccordionTrigger className="hover:no-underline py-2">
                            <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                              <div className="text-left">
                                <p className="text-sm font-medium">
                                  {mesAbrev(c.competenciaMes, c.competenciaAno)}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {brl(c.valor)} · {formaPgtoLabel(c.formaPagamento)}
                                </p>
                              </div>
                              <StatusBadge value={c.status} />
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <p className="text-xs text-muted-foreground pb-2">
                              {c.observacoes ?? "Sem observações."}
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
