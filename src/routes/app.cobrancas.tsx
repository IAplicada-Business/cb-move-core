import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Upload,
  X,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { KpiCard } from "@/components/domain/KpiCard";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { StatusDistributionBar } from "@/components/domain/MetricVisuals";
import { PageHeader } from "@/components/brand/PageHeader";
import { DataToolbar, DataToolbarSearch } from "@/components/brand/DataToolbar";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import {
  CampoDiasSemana,
  CampoFrequenciaAtendimento,
} from "@/components/domain/AtendimentoCadastroFields";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { PacienteCobrancaSheet } from "@/components/domain/PacienteCobrancaSheet";
import { queryKeys } from "@/lib/queries";
import { brl, formatDate } from "@/lib/format";
import {
  fetchCobrancas,
  createCobranca,
  marcarComoPago,
  parcelarCobranca,
  type Cobranca,
} from "@/lib/queries/cobrancas";
import { fetchFinanceiroKpis } from "@/lib/queries/financeiro";
import { fetchCobrancaNfResumo } from "@/lib/queries/notas-fiscais";
import { fetchPacientes } from "@/lib/queries/pacientes";
import { podeMarcarComoPago, resolverNfFluxoStatus } from "@/lib/domain/cobranca-nf-fluxo";
import { CobrancaNfFluxoBadge } from "@/components/domain/CobrancaNfFluxoBadge";
import {
  agregarCobrancasPorPaciente,
  calcularKpisDeCobrancas,
  type PacienteCobrancaResumo,
  type StatusResumo,
} from "@/lib/domain/cobrancas-por-paciente";
import type { CobrancaStatus, FormaPagamento, NfStatus } from "@/lib/types";
import {
  parseCSVBradesco,
  parseOFX,
  matchTransacoesComCobrancas,
  type MatchCobranca,
} from "@/lib/extrato-parser";
import { cn } from "@/lib/utils";
import { assertFinanceAccess } from "@/lib/route-access";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/app/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças · CB MOVE" }] }),
  beforeLoad: () => assertFinanceAccess(),
  component: CobrancasPage,
});

// ─── helpers ────────────────────────────────────────────────────────────────

/** Radix Select não aceita value="" em SelectItem — use "todos" como sentinela. */
const FILTRO_TODOS = "todos";

const MESES_FULL = [
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

function competenciaOpcoes() {
  const now = new Date();
  const opts: { label: string; mes: number; ano: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      label: `${MESES_ABREV[d.getMonth()]}/${d.getFullYear()}`,
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
    });
  }
  return opts;
}

// ─── schemas ────────────────────────────────────────────────────────────────

const novaCobrancaSchema = z.object({
  pacienteId: z.string().min(1, "Selecione o paciente"),
  competenciaMes: z.coerce.number().min(1).max(12),
  competenciaAno: z.coerce.number().min(2020).max(2100),
  tipo: z.enum(["particular", "judicial", "convenio", "puc"] as const),
  regime: z.enum(["mensalista", "por_sessao"] as const),
  servico: z.string().min(1, "Informe o serviço"),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  formaPagamento: z.enum([
    "boleto",
    "deposito",
    "transferencia",
    "alvara_judicial",
    "convenio_direto",
  ] as const),
  vencimento: z.string().min(1, "Informe o vencimento"),
  status: z.enum([
    "pendente",
    "pago",
    "atrasado",
    "cancelado",
    "vencido",
    "aguardando_convenio",
    "aguardando_alvara",
    "regularizar_retroativa",
  ] as const),
  frequenciaAtendimento: z.string().optional(),
  diasSemana: z.string().optional(),
  qtdSessoes: z.coerce.number().int().positive().optional(),
  observacoes: z.string().optional(),
});

type NovaCobrancaForm = z.infer<typeof novaCobrancaSchema>;

const marcarPagoSchema = z.object({
  pagoEm: z.string().min(1, "Informe a data de pagamento"),
});

type MarcarPagoForm = z.infer<typeof marcarPagoSchema>;

const parcelarSchema = z.object({
  valorTotal: z.coerce.number().positive("Valor deve ser positivo"),
  numeroParcelas: z.coerce.number().int().min(2, "Informe ao menos 2 parcelas").max(60),
  competenciaInicialMes: z.coerce.number().min(1).max(12),
  competenciaInicialAno: z.coerce.number().min(2020).max(2100),
  cancelarOriginal: z.boolean(),
});

type ParcelarForm = z.infer<typeof parcelarSchema>;

// ─── Modal Nova Cobrança ─────────────────────────────────────────────────────

function ModalNovaCobranca({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const now = new Date();

  const pacientes = useQuery({
    queryKey: queryKeys.pacientes.list(),
    queryFn: () => fetchPacientes({ ativo: true }),
    enabled: open,
  });

  const form = useForm<NovaCobrancaForm>({
    resolver: zodResolver(novaCobrancaSchema),
    defaultValues: {
      competenciaMes: now.getMonth() + 1,
      competenciaAno: now.getFullYear(),
      tipo: "particular",
      regime: "mensalista",
      servico: "Fisioterapia Neurológica",
      formaPagamento: "deposito",
      status: "pendente",
      frequenciaAtendimento: "",
      diasSemana: "",
    },
  });

  const watchPacienteId = form.watch("pacienteId");

  useEffect(() => {
    if (!open || !watchPacienteId) return;
    const pacienteSelecionado = pacientes.data?.find((p) => p.id === watchPacienteId);
    if (!pacienteSelecionado) return;

    form.setValue("tipo", pacienteSelecionado.tipo);
    form.setValue("regime", pacienteSelecionado.regimeCobranca);
    if (pacienteSelecionado.valorMensal) {
      form.setValue("valor", pacienteSelecionado.valorMensal);
    }
    if (pacienteSelecionado.formaPagamentoPreferida) {
      form.setValue("formaPagamento", pacienteSelecionado.formaPagamentoPreferida);
    }
    if (pacienteSelecionado.frequenciaAtendimento) {
      form.setValue("frequenciaAtendimento", pacienteSelecionado.frequenciaAtendimento);
    }
    if (pacienteSelecionado.diasSemana) {
      form.setValue("diasSemana", pacienteSelecionado.diasSemana);
    }
  }, [open, watchPacienteId, pacientes.data, form]);

  const mutation = useMutation({
    mutationFn: (data: NovaCobrancaForm) =>
      createCobranca({
        pacienteId: data.pacienteId,
        tipo: data.tipo as PacienteTipo,
        regime: data.regime as RegimeCobranca,
        servico: data.servico,
        valor: data.valor,
        formaPagamento: data.formaPagamento as FormaPagamento,
        vencimento: data.vencimento,
        competenciaMes: data.competenciaMes,
        competenciaAno: data.competenciaAno,
        qtdSessoes: data.qtdSessoes ? Number(data.qtdSessoes) : undefined,
        frequenciaAtendimento: data.frequenciaAtendimento?.trim() || undefined,
        diasSemana: data.diasSemana?.trim() || undefined,
        observacoes: data.observacoes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      qc.invalidateQueries({ queryKey: ["financeiro", "kpis"] });
      qc.invalidateQueries({ queryKey: ["financeiro", "extrato"] });
      toast.success("Cobrança criada com sucesso");
      form.reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {/* Paciente */}
            <FormField
              control={form.control}
              name="pacienteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pacientes.isLoading && (
                        <SelectItem value="__loading" disabled>
                          Carregando…
                        </SelectItem>
                      )}
                      {(pacientes.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Competência */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="competenciaMes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês competência</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MESES_FULL.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="competenciaAno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} min={2020} max={2100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tipo e Regime */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="particular">Particular</SelectItem>
                        <SelectItem value="convenio">Convênio</SelectItem>
                        <SelectItem value="judicial">Judicial</SelectItem>
                        <SelectItem value="puc">PUC</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mensalista">Mensalista</SelectItem>
                        <SelectItem value="por_sessao">Por sessão</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Serviço */}
            <FormField
              control={form.control}
              name="servico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Atendimento — aparece no extrato financeiro
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="frequenciaAtendimento"
                  render={({ field }) => <CampoFrequenciaAtendimento field={field} />}
                />
                <FormField
                  control={form.control}
                  name="diasSemana"
                  render={({ field }) => <CampoDiasSemana field={field} />}
                />
              </div>
              <FormField
                control={form.control}
                name="qtdSessoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº sessões no mês</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : e.target.value)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valor e Forma de pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="formaPagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de pagamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="deposito">Depósito</SelectItem>
                        <SelectItem value="transferencia">PIX / transferência</SelectItem>
                        <SelectItem value="alvara_judicial">Alvará judicial</SelectItem>
                        <SelectItem value="convenio_direto">Convênio direto</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Vencimento e Status */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="atrasado">Atrasado</SelectItem>
                        <SelectItem value="aguardando_convenio">Aguard. convênio</SelectItem>
                        <SelectItem value="aguardando_alvara">Aguard. alvará</SelectItem>
                        <SelectItem value="regularizar_retroativa">
                          Regularizar retroativa
                        </SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Criar cobrança"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Marcar como Pago ───────────────────────────────────────────────────

function ModalMarcarPago({
  cobranca,
  nfStatus,
  onClose,
}: {
  cobranca: Cobranca | null;
  nfStatus?: NfStatus | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const nfFluxo = cobranca ? resolverNfFluxoStatus(cobranca, nfStatus) : "nao_aplica";
  const podeConfirmar = podeMarcarComoPago(nfFluxo);
  const form = useForm<MarcarPagoForm>({
    resolver: zodResolver(marcarPagoSchema),
    defaultValues: { pagoEm: new Date().toISOString().split("T")[0] },
  });

  const mutation = useMutation({
    mutationFn: (data: MarcarPagoForm) => marcarComoPago(cobranca!.id, data.pagoEm),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      qc.invalidateQueries({ queryKey: ["financeiro", "kpis"] });
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      if (result.nfDisparada) {
        toast.success("Cobrança marcada como paga e NF enviada à Focus");
      } else if (result.nfErro?.includes("data_especifica")) {
        toast.success("Cobrança marcada como paga (NF será emitida na data cadastrada)");
      } else if (result.nfErro) {
        toast.success("Cobrança marcada como paga");
        toast.warning(`NF não disparada: ${result.nfErro}`);
      } else {
        toast.success("Cobrança marcada como paga");
      }
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={!!cobranca}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar como pago</DialogTitle>
        </DialogHeader>
        {cobranca && (
          <div className="text-sm text-muted-foreground mb-2 space-y-2">
            <div>
              <span className="font-medium text-foreground">{cobranca.pacienteNome}</span>
              {" — "}
              {brl(cobranca.valor)}
            </div>
            <CobrancaNfFluxoBadge fluxo={nfFluxo} />
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="pagoEm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do pagamento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending || !podeConfirmar}>
                {mutation.isPending ? "Salvando…" : "Confirmar pagamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Parcelar Cobrança ─────────────────────────────────────────────────

function proximoMes(mes: number, ano: number) {
  const d = new Date(ano, mes, 1);
  return { mes: d.getMonth() + 1, ano: d.getFullYear() };
}

function ModalParcelarCobranca({
  cobranca,
  onClose,
}: {
  cobranca: Cobranca | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const inicial = cobranca
    ? proximoMes(
        cobranca.competenciaMes ?? new Date().getMonth() + 1,
        cobranca.competenciaAno ?? new Date().getFullYear(),
      )
    : { mes: new Date().getMonth() + 1, ano: new Date().getFullYear() };

  const form = useForm<ParcelarForm>({
    resolver: zodResolver(parcelarSchema),
    values: cobranca
      ? {
          valorTotal: cobranca.valor,
          numeroParcelas: 2,
          competenciaInicialMes: inicial.mes,
          competenciaInicialAno: inicial.ano,
          cancelarOriginal: true,
        }
      : undefined,
  });

  const valorTotal = form.watch("valorTotal");
  const numeroParcelas = form.watch("numeroParcelas");
  const valorParcela = numeroParcelas > 0 ? (valorTotal || 0) / numeroParcelas : 0;

  const mutation = useMutation({
    mutationFn: (data: ParcelarForm) =>
      parcelarCobranca({
        cobrancaOriginal: cobranca!,
        valorTotal: data.valorTotal,
        numeroParcelas: data.numeroParcelas,
        competenciaInicialMes: data.competenciaInicialMes,
        competenciaInicialAno: data.competenciaInicialAno,
        cancelarOriginal: data.cancelarOriginal,
      }),
    onSuccess: (criadas) => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      qc.invalidateQueries({ queryKey: ["financeiro", "kpis"] });
      qc.invalidateQueries({ queryKey: ["financeiro", "extrato"] });
      toast.success(`${criadas.length} parcela(s) criada(s) com sucesso`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={!!cobranca}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Parcelar cobrança</DialogTitle>
        </DialogHeader>
        {cobranca && (
          <p className="text-sm text-muted-foreground -mt-2">
            <span className="font-medium text-foreground">{cobranca.pacienteNome}</span>
            {" — recebido via "}
            {cobranca.formaPagamento === "deposito"
              ? "depósito"
              : cobranca.formaPagamento === "alvara_judicial"
                ? "alvará judicial"
                : "transferência"}
            . Divida em N cobranças mensais futuras a partir da competência escolhida.
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="valorTotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor total (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numeroParcelas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº de parcelas</FormLabel>
                    <FormControl>
                      <Input type="number" min={2} max={60} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="competenciaInicialMes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1ª competência</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MESES_FULL.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="competenciaInicialAno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} min={2020} max={2100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {valorTotal > 0 && numeroParcelas >= 2 && (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                {numeroParcelas}x de{" "}
                <span className="font-medium tabular-nums">{brl(valorParcela)}</span> começando em{" "}
                {MESES_ABREV[(form.watch("competenciaInicialMes") - 1 + 12) % 12]}/
                {form.watch("competenciaInicialAno")}
              </div>
            )}

            <FormField
              control={form.control}
              name="cancelarOriginal"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div>
                    <FormLabel className="font-normal">
                      Cancelar a cobrança original ao criar as parcelas
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Evita contar o valor duas vezes nos relatórios financeiros.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Gerando…" : "Criar parcelas"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Conciliação Bradesco ───────────────────────────────────────────────

const confiancaCls: Record<MatchCobranca["confianca"], string> = {
  alta: "text-green-600",
  media: "text-yellow-600",
  baixa: "text-red-600",
};

function ModalExtrato({
  open,
  onClose,
  cobrancas,
}: {
  open: boolean;
  onClose: () => void;
  cobrancas: Cobranca[];
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [matches, setMatches] = useState<MatchCobranca[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);

  function resetExtrato() {
    setMatches([]);
    setSelecionados(new Set());
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessando(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const transacoes = file.name.toLowerCase().endsWith(".ofx")
        ? parseOFX(content)
        : parseCSVBradesco(content);

      const cobSimples = cobrancas.map((c) => ({
        id: c.id,
        pacienteNome: c.pacienteNome ?? "",
        valor: c.valor,
        vencimento: c.vencimento ?? "",
        status: c.status,
      }));

      const result = matchTransacoesComCobrancas(transacoes, cobSimples);
      setMatches(result);
      setSelecionados(
        new Set(result.filter((m) => m.confianca === "alta").map((m) => m.cobrancaId)),
      );
      setProcessando(false);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  const confirmarMutation = useMutation({
    mutationFn: async () => {
      const sel = matches.filter((m) => selecionados.has(m.cobrancaId));
      await Promise.all(sel.map((m) => marcarComoPago(m.cobrancaId, m.transacao.data)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      qc.invalidateQueries({ queryKey: ["financeiro", "kpis"] });
      toast.success(`${selecionados.size} cobrança(s) marcada(s) como pagas`);
      resetExtrato();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetExtrato();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conciliação — Extrato Bradesco</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Arquivo do extrato (.csv ou .ofx)</Label>
            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={processando}
              >
                <Upload className="h-4 w-4 mr-1" />
                {processando ? "Processando…" : "Selecionar arquivo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.ofx"
                className="hidden"
                onChange={handleFile}
              />
              {matches.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {matches.length} match(es) encontrado(s)
                </span>
              )}
            </div>
          </div>

          {matches.length === 0 && !processando && (
            <p className="text-xs text-muted-foreground">
              Faça upload do extrato para ver os matches automáticos por valor e data de vencimento.
              Formato CSV Bradesco (Data;Histórico;Valor) ou OFX.
            </p>
          )}

          {matches.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Data extrato</TableHead>
                  <TableHead>Valor extrato</TableHead>
                  <TableHead>Dif. valor</TableHead>
                  <TableHead>Dif. dias</TableHead>
                  <TableHead>Confiança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((m) => (
                  <TableRow
                    key={m.cobrancaId}
                    className="cursor-pointer"
                    onClick={() => toggleSel(m.cobrancaId)}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selecionados.has(m.cobrancaId)}
                        onChange={() => toggleSel(m.cobrancaId)}
                        className="rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{m.pacienteNome}</TableCell>
                    <TableCell>{formatDate(m.transacao.data)}</TableCell>
                    <TableCell>{brl(m.transacao.valor)}</TableCell>
                    <TableCell>{brl(m.diferenca)}</TableCell>
                    <TableCell>{m.diasDiferenca}d</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold ${confiancaCls[m.confianca]}`}>
                        {m.confianca.charAt(0).toUpperCase() + m.confianca.slice(1)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetExtrato();
              onClose();
            }}
          >
            Fechar
          </Button>
          {matches.length > 0 && (
            <Button
              onClick={() => confirmarMutation.mutate()}
              disabled={selecionados.size === 0 || confirmarMutation.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              {confirmarMutation.isPending
                ? "Confirmando…"
                : `Confirmar ${selecionados.size} pagamento(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Linha agregada por paciente ─────────────────────────────────────────────

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

function PacienteCobrancaRow({
  resumo,
  onOpen,
}: {
  resumo: PacienteCobrancaResumo;
  onOpen: () => void;
}) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <TableCell className="font-medium">{resumo.pacienteNome}</TableCell>
      <TableCell>
        <TipoBadge value={resumo.tipo} />
      </TableCell>
      <TableCell className="text-sm tabular-nums">{resumo.progressoLabel}</TableCell>
      <TableCell>
        <StatusResumoBadge value={resumo.statusResumo} />
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {brl(resumo.totalValor)}
      </TableCell>
      <TableCell className="w-10 text-muted-foreground">
        <ChevronRight className="h-4 w-4" />
      </TableCell>
    </TableRow>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function CobrancasPage() {
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const compDefault = `${mesAtual}-${anoAtual}`;

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<CobrancaStatus | "">("");
  const [filtroFormaPgto, setFiltroFormaPgto] = useState<FormaPagamento | "">("");
  const [filtroComp, setFiltroComp] = useState<string>(compDefault);
  const [modalNova, setModalNova] = useState(false);
  const [marcarPago, setMarcarPago] = useState<Cobranca | null>(null);
  const [parcelando, setParcelando] = useState<Cobranca | null>(null);
  const [modalExtrato, setModalExtrato] = useState(false);
  const [pacienteSheetId, setPacienteSheetId] = useState<string | null>(null);
  const [pacienteSheetNome, setPacienteSheetNome] = useState<string | null>(null);

  const compOpts = competenciaOpcoes();
  const todosMeses = filtroComp === "";
  const compMes = filtroComp ? Number(filtroComp.split("-")[0]) : undefined;
  const compAno = filtroComp ? Number(filtroComp.split("-")[1]) : undefined;

  const filters = {
    search: search || undefined,
    status: (filtroStatus || undefined) as CobrancaStatus | undefined,
    formaPagamento: (filtroFormaPgto || undefined) as FormaPagamento | undefined,
    competenciaMes: compMes,
    competenciaAno: compAno,
  };

  const query = useQuery({
    queryKey: queryKeys.cobrancas.list(filters),
    queryFn: () => fetchCobrancas(filters),
  });

  const kpisMes = todosMeses ? mesAtual : (compMes ?? mesAtual);
  const kpisAno = todosMeses ? anoAtual : (compAno ?? anoAtual);

  const kpisQuery = useQuery({
    queryKey: queryKeys.financeiro.kpis(kpisAno, kpisMes),
    queryFn: () => fetchFinanceiroKpis(kpisMes, kpisAno),
    enabled: !todosMeses,
  });

  const cobrancas = query.data ?? [];
  const cobrancaIds = useMemo(() => cobrancas.map((c) => c.id), [cobrancas]);
  const nfResumoQuery = useQuery({
    queryKey: ["notas_fiscais", "cobrancaResumo", cobrancaIds],
    queryFn: () => fetchCobrancaNfResumo(cobrancaIds),
    enabled: cobrancaIds.length > 0,
  });
  const nfPorCobranca = nfResumoQuery.data ?? new Map();

  const pacientes = useMemo(() => agregarCobrancasPorPaciente(cobrancas), [cobrancas]);

  const kpis = useMemo(() => {
    if (todosMeses) return calcularKpisDeCobrancas(cobrancas);
    return kpisQuery.data ?? { total: 0, pago: 0, pendente: 0, vencido: 0 };
  }, [todosMeses, cobrancas, kpisQuery.data]);

  const kpiHint = todosMeses ? "Todos os meses" : `${MESES_ABREV[kpisMes - 1]}/${kpisAno}`;

  const temFiltro = !!(search || filtroStatus || filtroFormaPgto || filtroComp !== compDefault);

  const pacienteSheet = pacientes.find((p) => p.pacienteId === pacienteSheetId);

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Financeiro" }, { label: "Cobranças" }]}
        title="Cobranças"
        description="Gestão de faturamento e acompanhamento de pagamentos"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setModalExtrato(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Extrato Bradesco
            </Button>
            <Button
              size="sm"
              className="bg-cb-cyan-600 hover:bg-cb-cyan-700"
              onClick={() => setModalNova(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova cobrança
            </Button>
          </>
        }
      />

      <div className="rounded-[10px] border border-cb-cyan-600/20 bg-cb-cyan-050/50 px-5 py-4 text-sm text-foreground">
        Para depósito, PIX ou alvará: em{" "}
        <Link to="/app/notas-fiscais" className="font-medium text-cb-cyan-800 underline">
          Notas Fiscais
        </Link>
        , emita a NF antes do pagamento; depois marque a cobrança como paga aqui.
      </div>

      {(query.isError || (!todosMeses && kpisQuery.isError)) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(query.error as Error)?.message ??
            (kpisQuery.error as Error)?.message ??
            "Erro ao carregar dados financeiros."}
        </div>
      )}

      <KpiGrid columns={4}>
        <KpiCard
          label="Total do mês"
          value={brl(kpis.total)}
          accent="cyan"
          icon={<DollarSign className="h-5 w-5" />}
          hint={kpiHint}
          share={100}
        />
        <KpiCard
          label="Pago"
          value={brl(kpis.pago)}
          accent="lime"
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint={kpiHint}
          share={kpis.total > 0 ? (kpis.pago / kpis.total) * 100 : 0}
        />
        <KpiCard
          label="Pendente"
          value={brl(kpis.pendente)}
          accent="orange"
          icon={<Clock className="h-5 w-5" />}
          hint={kpiHint}
          share={kpis.total > 0 ? (kpis.pendente / kpis.total) * 100 : 0}
        />
        <KpiCard
          label="Vencido"
          value={brl(kpis.vencido)}
          accent="magenta"
          icon={<AlertTriangle className="h-5 w-5" />}
          hint={kpiHint}
          share={kpis.total > 0 ? (kpis.vencido / kpis.total) * 100 : 0}
        />
      </KpiGrid>

      {kpis.total > 0 && (
        <StatusDistributionBar
          totalLabel={`Composição · ${kpiHint}`}
          segments={[
            { label: "Pago", value: kpis.pago, colorClass: "bg-cb-lime" },
            { label: "Pendente", value: kpis.pendente, colorClass: "bg-cb-orange" },
            { label: "Vencido", value: kpis.vencido, colorClass: "bg-cb-magenta" },
          ]}
        />
      )}

      <DataToolbar>
        <DataToolbarSearch>
          <Search className="h-4 w-4 shrink-0 text-cb-muted" />
          <Input
            placeholder="Buscar por paciente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </DataToolbarSearch>

        <Select
          value={filtroComp || FILTRO_TODOS}
          onValueChange={(v) => setFiltroComp(v === FILTRO_TODOS ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODOS}>Todos os meses</SelectItem>
            {compOpts.map((o) => (
              <SelectItem key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtroStatus || FILTRO_TODOS}
          onValueChange={(v) => setFiltroStatus(v === FILTRO_TODOS ? "" : (v as CobrancaStatus))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODOS}>Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="aguardando_convenio">Aguard. convênio</SelectItem>
            <SelectItem value="aguardando_alvara">Aguard. alvará</SelectItem>
            <SelectItem value="regularizar_retroativa">Regularizar</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filtroFormaPgto || FILTRO_TODOS}
          onValueChange={(v) => setFiltroFormaPgto(v === FILTRO_TODOS ? "" : (v as FormaPagamento))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Forma pgto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODOS}>Todas as formas</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
            <SelectItem value="deposito">Depósito</SelectItem>
            <SelectItem value="transferencia">PIX / transferência</SelectItem>
            <SelectItem value="alvara_judicial">Alvará judicial</SelectItem>
            <SelectItem value="convenio_direto">Convênio direto</SelectItem>
          </SelectContent>
        </Select>

        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFiltroStatus("");
              setFiltroFormaPgto("");
              setFiltroComp(compDefault);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </DataToolbar>

      {query.isLoading ? (
        <LoadingState />
      ) : pacientes.length === 0 ? (
        <EmptyState
          title="Sem cobranças"
          description={
            temFiltro || todosMeses === false
              ? "Nenhuma cobrança para os filtros selecionados."
              : "Crie a primeira cobrança com o botão acima."
          }
          action={
            !temFiltro && filtroComp === compDefault ? (
              <Button size="sm" onClick={() => setModalNova(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nova cobrança
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DashboardSection
          eyebrow="Financeiro"
          accent="cyan"
          title="Cobranças"
          badge={<DashboardSectionBadge accent="cyan">{kpiHint}</DashboardSectionBadge>}
          noPadding
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacientes.map((p) => (
                <PacienteCobrancaRow
                  key={p.pacienteId}
                  resumo={p}
                  onOpen={() => {
                    setPacienteSheetId(p.pacienteId);
                    setPacienteSheetNome(p.pacienteNome);
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </DashboardSection>
      )}

      <ModalNovaCobranca open={modalNova} onClose={() => setModalNova(false)} />
      <ModalMarcarPago
        cobranca={marcarPago}
        nfStatus={marcarPago ? nfPorCobranca.get(marcarPago.id)?.status : null}
        onClose={() => setMarcarPago(null)}
      />
      <ModalParcelarCobranca cobranca={parcelando} onClose={() => setParcelando(null)} />
      <ModalExtrato
        open={modalExtrato}
        onClose={() => setModalExtrato(false)}
        cobrancas={cobrancas}
      />
      <PacienteCobrancaSheet
        pacienteId={pacienteSheetId}
        pacienteNome={pacienteSheetNome ?? pacienteSheet?.pacienteNome}
        onClose={() => {
          setPacienteSheetId(null);
          setPacienteSheetNome(null);
        }}
        onMarcarPago={(c) => setMarcarPago(c)}
        onParcelar={(c) => setParcelando(c)}
      />
    </DashboardPage>
  );
}
