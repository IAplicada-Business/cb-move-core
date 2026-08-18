import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { NotaFiscalDetailSheet } from "@/components/domain/NotaFiscalDetailSheet";
import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { StatusDistributionBar } from "@/components/domain/MetricVisuals";
import { CompetenciaFilterChip } from "@/components/domain/CompetenciaFilterChip";
import { PageHeader } from "@/components/brand/PageHeader";
import { DataToolbar, DataToolbarSearch } from "@/components/brand/DataToolbar";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries";
import { brl, formatDate } from "@/lib/format";
import {
  fetchNFs,
  createNF,
  emitNfManual,
  emitNfAutomatico,
  uploadNfPdf,
  documentoValidoParaNf,
  documentoElegivelCobranca,
  emitFocusDeCobranca,
  prepararEmitFocus,
  type NotaFiscal,
} from "@/lib/queries/notas-fiscais";
import { fetchPacientes } from "@/lib/queries/pacientes";
import {
  criarNfDeCobranca,
  fetchCobrancasSemNf,
  resolverDestinatarioNf,
  type CobrancaSemNf,
} from "@/lib/queries/financeiro";
import type { NfStatus, PacienteTipo } from "@/lib/types";
import { assertFinanceAccess } from "@/lib/route-access";
import { competenciaAtual, competenciaOpcoes } from "@/lib/competencia";

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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

export const Route = createFileRoute("/app/notas-fiscais")({
  head: () => ({ meta: [{ title: "Notas Fiscais · CB MOVE" }] }),
  beforeLoad: () => assertFinanceAccess(),
  component: NotasFiscaisPage,
});

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

/** Radix Select não aceita value="" em SelectItem — use "todos" como sentinela. */
const FILTRO_TODOS = "todos";
const FILTRO_TODAS_COMP = "todas";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Erro desconhecido";
}

const emitirNFSchema = z.object({
  pacienteId: z.string().min(1, "Selecione o paciente"),
  cobrancaId: z.string().optional(),
  competenciaMes: z.coerce.number().min(1).max(12),
  competenciaAno: z.coerce.number().min(2020).max(2100),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  destinatarioNome: z.string().min(1, "Informe o destinatário"),
  destinatarioDocumento: z.string().optional(),
  modo: z.enum(["manual", "automatico"]),
  numeroNf: z.string().optional(),
  corpoPacienteNome: z.string().optional(),
  corpoPacienteCpf: z.string().optional(),
  corpoNumeroProcesso: z.string().optional(),
  corpoTotalSessoes: z.coerce.number().optional(),
});

type EmitirNFForm = z.infer<typeof emitirNFSchema>;

type ModalEmitirProps = {
  open: boolean;
  onClose: () => void;
  prefill?: CobrancaSemNf | null;
};

function ModalEmitirNF({ open, onClose, prefill }: ModalEmitirProps) {
  const qc = useQueryClient();
  const now = new Date();
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const pacientes = useQuery({
    queryKey: queryKeys.pacientes.list(),
    queryFn: () => fetchPacientes({ ativo: true }),
    enabled: open,
  });

  const form = useForm<EmitirNFForm>({
    resolver: zodResolver(emitirNFSchema),
    defaultValues: {
      pacienteId: "",
      competenciaMes: now.getMonth() + 1,
      competenciaAno: now.getFullYear(),
      modo: "automatico",
      valor: undefined,
      destinatarioNome: "",
      destinatarioDocumento: "",
    },
  });

  const watchPacienteId = form.watch("pacienteId");
  const watchCobrancaId = form.watch("cobrancaId");
  const watchModo = form.watch("modo");
  const pacienteSelecionado = pacientes.data?.find((p) => p.id === watchPacienteId);
  const isJudicial = pacienteSelecionado?.tipo === "judicial";
  const isParticular = pacienteSelecionado?.tipo === "particular";

  useEffect(() => {
    if (!open) return;
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    if (prefill) {
      form.reset({
        pacienteId: prefill.pacienteId,
        cobrancaId: prefill.cobrancaId,
        competenciaMes: prefill.competenciaMes ?? mesAtual,
        competenciaAno: prefill.competenciaAno ?? anoAtual,
        valor: prefill.valor,
        destinatarioNome: prefill.destinatarioNome ?? "",
        destinatarioDocumento: prefill.destinatarioDocumento ?? "",
        modo: "automatico",
      });
      return;
    }
    form.reset({
      pacienteId: "",
      competenciaMes: mesAtual,
      competenciaAno: anoAtual,
      modo: "automatico",
      destinatarioNome: "",
      destinatarioDocumento: "",
    });
  }, [open, prefill, form]);

  useEffect(() => {
    if (!watchCobrancaId || !open) return;
    resolverDestinatarioNf(watchCobrancaId)
      .then((d) => {
        form.setValue("destinatarioNome", d.destinatarioNome);
        form.setValue("destinatarioDocumento", d.destinatarioDocumento ?? "");
        form.setValue("valor", d.valor);
        form.setValue("competenciaMes", d.competenciaMes ?? form.getValues("competenciaMes"));
        form.setValue("competenciaAno", d.competenciaAno ?? form.getValues("competenciaAno"));
        if (d.corpoPacienteNome) form.setValue("corpoPacienteNome", d.corpoPacienteNome);
        if (d.corpoPacienteCpf) form.setValue("corpoPacienteCpf", d.corpoPacienteCpf);
        if (d.corpoNumeroProcesso) form.setValue("corpoNumeroProcesso", d.corpoNumeroProcesso);
        if (d.corpoTotalSessoes) form.setValue("corpoTotalSessoes", d.corpoTotalSessoes);
      })
      .catch((e: Error) => toast.error(e.message));
  }, [watchCobrancaId, open, form]);

  useEffect(() => {
    if (!pacienteSelecionado || watchCobrancaId) return;
    if (pacienteSelecionado.tipo === "particular") {
      form.setValue("destinatarioNome", pacienteSelecionado.nome);
      form.setValue("destinatarioDocumento", pacienteSelecionado.cpf ?? "");
    }
    if (pacienteSelecionado.valorMensal) form.setValue("valor", pacienteSelecionado.valorMensal);
    if (pacienteSelecionado.tipo === "judicial") {
      form.setValue("corpoPacienteNome", pacienteSelecionado.nome);
      form.setValue("corpoPacienteCpf", pacienteSelecionado.cpf ?? "");
      form.setValue("corpoNumeroProcesso", pacienteSelecionado.numeroProcesso ?? "");
    }
  }, [watchPacienteId, pacienteSelecionado, watchCobrancaId, form]);

  const mutation = useMutation({
    mutationFn: async (data: EmitirNFForm) => {
      const tipo = (pacienteSelecionado?.tipo ?? "particular") as PacienteTipo;
      let nfId: string;

      if (data.cobrancaId) {
        nfId = await criarNfDeCobranca(data.cobrancaId);
      } else {
        const nf = await createNF({
          pacienteId: data.pacienteId,
          tipo,
          destinatarioNome: data.destinatarioNome,
          destinatarioDocumento: data.destinatarioDocumento,
          valor: data.valor,
          competenciaMes: data.competenciaMes,
          competenciaAno: data.competenciaAno,
          corpoPacienteNome: data.corpoPacienteNome,
          corpoPacienteCpf: data.corpoPacienteCpf,
          corpoNumeroProcesso: data.corpoNumeroProcesso,
          corpoTotalSessoes: data.corpoTotalSessoes,
        });
        nfId = nf.id;
      }

      if (data.modo === "manual") {
        if (!data.numeroNf || !pdfFile) throw new Error("Informe número da NF e PDF");
        const pdfUrl = await uploadNfPdf(pdfFile, data.competenciaAno, data.numeroNf);
        await emitNfManual(nfId, data.numeroNf, pdfUrl);
      } else {
        const doc = (data.destinatarioDocumento ?? "").replace(/\D/g, "");
        if (doc.length !== 11 && doc.length !== 14) {
          throw new Error(
            "Emissão automática exige CPF (11 dígitos) ou CNPJ (14 dígitos) do destinatário",
          );
        }
        return emitNfAutomatico(nfId);
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      if (result?.status === "processando") {
        toast.success("NF enviada à Focus — aguardando autorização");
      } else {
        toast.success("NF processada com sucesso");
      }
      setPdfFile(null);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPdfFile(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir Nota Fiscal</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="pacienteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={!!prefill}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            {pacienteSelecionado && (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                Tipo: <span className="font-medium capitalize">{pacienteSelecionado.tipo}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="competenciaMes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês</FormLabel>
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
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destinatarioNome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinatário — Nome</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly={isParticular} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destinatarioDocumento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinatário — CPF / CNPJ</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      readOnly={isParticular}
                      placeholder={isParticular ? "CPF do paciente" : "000.000.000/0001-00"}
                    />
                  </FormControl>
                  {isParticular && (
                    <p className="text-xs text-muted-foreground">
                      Particular: tomador é o paciente (CPF bloqueado).
                    </p>
                  )}
                </FormItem>
              )}
            />

            {isJudicial && (
              <div className="rounded-md border border-dashed p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Corpo da NF — Judicial
                </p>
                <FormField
                  control={form.control}
                  name="corpoPacienteNome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do paciente</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="corpoNumeroProcesso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Processo</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="modo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modo de emissão</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manual">Manual (número + PDF)</SelectItem>
                      <SelectItem value="automatico">Automático (Focus NFe)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {watchModo === "automatico" && (
              <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                Homologação Focus NFe — emite NFS-e Nacional POA e grava PDF no sistema. Certificado
                A1 já configurado no painel.
              </p>
            )}

            {watchModo === "manual" && (
              <>
                <FormField
                  control={form.control}
                  name="numeroNf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da NF</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="NF-001284" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div>
                  <Label>Upload PDF</Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    className="mt-1"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Processando…" : "Emitir NF"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NFRow({
  nf,
  hidePaciente,
  selectable,
  selected,
  onSelectedChange,
  selectionDisabled,
  onOpen,
}: {
  nf: NotaFiscal;
  hidePaciente?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  selectionDisabled?: boolean;
  onOpen: () => void;
}) {
  const isJudicial = nf.tipo === "judicial";
  const podeSelecionar =
    selectable &&
    (nf.status === "pendente" || nf.status === "erro") &&
    documentoValidoParaNf(nf.destinatarioDocumento);

  return (
    <TableRow className="cursor-pointer hover:bg-cb-cyan-050/40" onClick={onOpen}>
      {selectable && (
        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer rounded border border-primary accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            checked={!!selected}
            onChange={(e) => onSelectedChange?.(e.target.checked)}
            disabled={selectionDisabled || !podeSelecionar}
            aria-label={`Selecionar NF ${nf.pacienteNome ?? nf.id}`}
            title={
              podeSelecionar
                ? undefined
                : nf.status === "processando"
                  ? "NF já enviada à Focus"
                  : "CPF/CNPJ ausente — complete o cadastro"
            }
          />
        </TableCell>
      )}
      <TableCell className={`font-mono text-sm text-muted-foreground ${selectable ? "" : "pl-4"}`}>
        {nf.numero ?? "—"}
      </TableCell>
      {!hidePaciente && <TableCell className="font-medium">{nf.pacienteNome ?? "—"}</TableCell>}
      <TableCell>
        <div className="font-medium">{nf.destinatarioNome ?? "—"}</div>
        {nf.destinatarioDocumento && (
          <div className="text-xs text-muted-foreground">{nf.destinatarioDocumento}</div>
        )}
        {isJudicial && nf.corpoPacienteNome && (
          <div className="mt-0.5 text-xs text-muted-foreground truncate max-w-[200px]">
            Corpo: {nf.corpoPacienteNome}
          </div>
        )}
      </TableCell>
      <TableCell>
        <TipoBadge value={nf.tipo} />
      </TableCell>
      <TableCell className="text-sm">{formatDate(nf.emissao)}</TableCell>
      <TableCell>
        <StatusBadge kind="nf" value={nf.status} />
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{brl(nf.valor)}</TableCell>
      <TableCell className="w-10 pr-4 text-muted-foreground">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </TableCell>
    </TableRow>
  );
}

type NfGrupo = {
  key: string;
  label: string;
  documento: string | null;
  total: number;
  temErro: boolean;
  temPendente: boolean;
  latest: string;
  nfs: NotaFiscal[];
};

function agruparPorCliente(nfs: NotaFiscal[]): NfGrupo[] {
  const map = new Map<string, NfGrupo>();
  for (const nf of nfs) {
    const key = nf.pacienteId || nf.destinatarioNome || "sem-cliente";
    const label = nf.pacienteNome || nf.destinatarioNome || "Sem paciente";
    let grupo = map.get(key);
    if (!grupo) {
      grupo = {
        key,
        label,
        documento: nf.destinatarioDocumento ?? null,
        total: 0,
        temErro: false,
        temPendente: false,
        latest: nf.createdAt,
        nfs: [],
      };
      map.set(key, grupo);
    }
    grupo.nfs.push(nf);
    grupo.total += nf.valor;
    if (nf.status === "erro") grupo.temErro = true;
    if (nf.status === "pendente" || nf.status === "processando") grupo.temPendente = true;
    if (nf.createdAt > grupo.latest) grupo.latest = nf.createdAt;
  }
  return Array.from(map.values()).sort((a, b) => b.latest.localeCompare(a.latest));
}

function DestinatarioDetalhes({
  nome,
  documento,
  telefone,
  corpoNome,
  corpoCpf,
  corpoProcesso,
  isJudicial,
}: {
  nome: string | null | undefined;
  documento?: string | null;
  telefone?: string | null;
  corpoNome?: string | null;
  corpoCpf?: string | null;
  corpoProcesso?: string | null;
  isJudicial?: boolean;
}) {
  return (
    <>
      <div>{nome ?? "—"}</div>
      {documento && <div className="text-xs text-muted-foreground">CPF/CNPJ: {documento}</div>}
      {telefone && <div className="text-xs text-muted-foreground">Tel: {telefone}</div>}
      {isJudicial && corpoNome && (
        <div className="text-xs text-muted-foreground mt-0.5">
          Corpo: {corpoNome}
          {corpoCpf && ` · CPF ${corpoCpf}`}
          {corpoProcesso && ` · proc. ${corpoProcesso}`}
        </div>
      )}
    </>
  );
}

function LinhaAEmitir({
  row,
  onEmitir,
  selected,
  onSelectedChange,
  selectionDisabled,
}: {
  row: CobrancaSemNf;
  onEmitir: () => void;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  selectionDisabled?: boolean;
}) {
  const elegivel = documentoElegivelCobranca(row);
  const docExibicao = row.destinatarioDocumento ?? row.pacienteCpf;
  return (
    <TableRow
      className={`bg-amber-50/50 dark:bg-amber-950/20 ${!elegivel ? "opacity-90" : ""} ${selectionDisabled ? "" : "cursor-pointer hover:bg-amber-100/60"}`}
      onClick={() => {
        if (!selectionDisabled) onSelectedChange(!selected);
      }}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-primary accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          checked={selected}
          onChange={(e) => onSelectedChange(e.target.checked)}
          disabled={selectionDisabled}
          aria-label={`Selecionar ${row.pacienteNome}`}
        />
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">—</TableCell>
      <TableCell className="font-medium">{row.pacienteNome}</TableCell>
      <TableCell>
        <DestinatarioDetalhes
          nome={row.destinatarioNome ?? row.pacienteNome}
          documento={docExibicao}
          telefone={row.pacienteTelefone}
        />
        {!elegivel && (
          <span className="mt-1 inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive border-destructive/30">
              Sem CPF/CNPJ no cadastro
            </span>
            <Link
              to="/app/pacientes/$pacienteId"
              params={{ pacienteId: row.pacienteId }}
              className="text-xs text-primary underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              Completar cadastro
            </Link>
          </span>
        )}
      </TableCell>
      <TableCell>
        <TipoBadge value={row.tipo} />
      </TableCell>
      <TableCell className="text-sm">
        <StatusBadge value={row.status} />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border-amber-200">
          A emitir
        </span>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{brl(row.valor)}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={onEmitir}>
          Emitir
        </Button>
      </TableCell>
    </TableRow>
  );
}

function NotasFiscaisPage() {
  const qc = useQueryClient();
  const compDefault = competenciaAtual();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<NfStatus | "">("");
  const [filtroTipo, setFiltroTipo] = useState<PacienteTipo | "">("");
  const [filtroComp, setFiltroComp] = useState(compDefault);
  const [modalEmitir, setModalEmitir] = useState(false);
  const [prefill, setPrefill] = useState<CobrancaSemNf | null>(null);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [selectedCobrancaIds, setSelectedCobrancaIds] = useState<Set<string>>(new Set());
  const [selectedNfIds, setSelectedNfIds] = useState<Set<string>>(new Set());
  const [confirmBulkEmit, setConfirmBulkEmit] = useState(false);
  const [confirmBulkEmitNfs, setConfirmBulkEmitNfs] = useState(false);
  const [bulkTargetCobrancas, setBulkTargetCobrancas] = useState<CobrancaSemNf[]>([]);
  const [bulkTargetNfs, setBulkTargetNfs] = useState<NotaFiscal[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [detailNf, setDetailNf] = useState<NotaFiscal | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectAllNfRef = useRef<HTMLInputElement>(null);

  const compSugestoes = useMemo(() => competenciaOpcoes(), []);
  const now = new Date();
  const compMes =
    filtroComp && filtroComp !== FILTRO_TODAS_COMP ? Number(filtroComp.split("-")[0]) : undefined;
  const compAno =
    filtroComp && filtroComp !== FILTRO_TODAS_COMP ? Number(filtroComp.split("-")[1]) : undefined;

  const filters = {
    search: search || undefined,
    status: (filtroStatus || undefined) as NfStatus | undefined,
    tipo: (filtroTipo || undefined) as PacienteTipo | undefined,
    competenciaMes: compMes,
    competenciaAno: compAno,
  };

  const query = useQuery({
    queryKey: queryKeys.notasFiscais.list(filters),
    queryFn: () => fetchNFs(filters),
  });

  const semNfMes = compMes ?? now.getMonth() + 1;
  const semNfAno = compAno ?? now.getFullYear();

  const semNfQuery = useQuery({
    queryKey: queryKeys.financeiro.cobrancasSemNf(semNfAno, semNfMes),
    queryFn: () => fetchCobrancasSemNf(semNfMes, semNfAno),
    staleTime: 30_000,
  });

  const nfs = query.data ?? [];

  useEffect(() => {
    if (!detailNf) return;
    const fresh = nfs.find((n) => n.id === detailNf.id);
    if (fresh) setDetailNf(fresh);
    else setDetailNf(null);
  }, [nfs, detailNf]);
  const aEmitir = semNfQuery.data ?? [];
  const temFiltro = !!(search || filtroStatus || filtroTipo || filtroComp !== compDefault);
  const grupos = useMemo(() => agruparPorCliente(nfs), [nfs]);
  const aEmitirElegiveis = useMemo(
    () => aEmitir.filter((row) => documentoElegivelCobranca(row)),
    [aEmitir],
  );
  const nfsFocusPendentes = useMemo(
    () =>
      nfs.filter(
        (nf) =>
          (nf.status === "pendente" || nf.status === "erro") &&
          documentoValidoParaNf(nf.destinatarioDocumento),
      ),
    [nfs],
  );
  const selectedNfs = useMemo(
    () => nfs.filter((nf) => selectedNfIds.has(nf.id)),
    [nfs, selectedNfIds],
  );
  const allNfsFocusSelected =
    nfsFocusPendentes.length > 0 && nfsFocusPendentes.every((nf) => selectedNfIds.has(nf.id));
  const someNfsFocusSelected = nfsFocusPendentes.some((nf) => selectedNfIds.has(nf.id));
  const selectedCobrancas = useMemo(
    () => aEmitir.filter((row) => selectedCobrancaIds.has(row.cobrancaId)),
    [aEmitir, selectedCobrancaIds],
  );
  const selectedCobrancasElegiveis = useMemo(
    () => selectedCobrancas.filter((row) => documentoElegivelCobranca(row)),
    [selectedCobrancas],
  );
  const aEmitirSemDocumento = aEmitir.length - aEmitirElegiveis.length;
  const allCobrancasSelected =
    aEmitir.length > 0 && aEmitir.every((row) => selectedCobrancaIds.has(row.cobrancaId));
  const someCobrancasSelected = aEmitir.some((row) => selectedCobrancaIds.has(row.cobrancaId));

  useEffect(() => {
    setOpenGroups(search.trim() ? grupos.map((g) => g.key) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setSelectedCobrancaIds(new Set());
    setSelectedNfIds(new Set());
  }, [filtroComp]);

  useEffect(() => {
    const ids = new Set(aEmitir.map((row) => row.cobrancaId));
    setSelectedCobrancaIds((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [aEmitir]);

  useEffect(() => {
    const ids = new Set(nfsFocusPendentes.map((nf) => nf.id));
    setSelectedNfIds((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [nfsFocusPendentes]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someCobrancasSelected && !allCobrancasSelected;
    }
  }, [someCobrancasSelected, allCobrancasSelected]);

  useEffect(() => {
    if (selectAllNfRef.current) {
      selectAllNfRef.current.indeterminate = someNfsFocusSelected && !allNfsFocusSelected;
    }
  }, [someNfsFocusSelected, allNfsFocusSelected]);

  const bulkEmitMutation = useMutation({
    mutationFn: async (cobrancas: CobrancaSemNf[]) => {
      const erros: string[] = [];
      let ok = 0;
      setBulkProgress({ done: 0, total: cobrancas.length });

      for (let i = 0; i < cobrancas.length; i++) {
        const row = cobrancas[i];
        try {
          const result = await emitFocusDeCobranca(row.cobrancaId, { timeoutMs: 30_000 });
          if (!result?.ok || result.status !== "processando") {
            throw new Error(result?.error ?? result?.message ?? "Focus não aceitou a emissão");
          }
          ok += 1;
        } catch (e) {
          erros.push(`${row.pacienteNome}: ${errorMessage(e)}`);
        }
        setBulkProgress({ done: i + 1, total: cobrancas.length });
      }

      return { ok, erros };
    },
    onSuccess: ({ ok, erros }) => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      setSelectedCobrancaIds(new Set());
      setBulkTargetCobrancas([]);
      setConfirmBulkEmit(false);

      if (erros.length === 0) {
        toast.success(`${ok} nota${ok > 1 ? "s" : ""} enviada${ok > 1 ? "s" : ""} à Focus`);
      } else if (ok > 0) {
        toast.message(`${ok} emitida${ok > 1 ? "s" : ""}, ${erros.length} com erro`, {
          description: erros.slice(0, 3).join(" · "),
        });
      } else {
        toast.error("Nenhuma NF emitida", { description: erros.slice(0, 3).join(" · ") });
      }
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
    onSettled: () => setBulkProgress(null),
  });

  const bulkEmitNfsMutation = useMutation({
    mutationFn: async (notas: NotaFiscal[]) => {
      const erros: string[] = [];
      let ok = 0;
      setBulkProgress({ done: 0, total: notas.length });

      for (let i = 0; i < notas.length; i++) {
        const nf = notas[i];
        try {
          await prepararEmitFocus(nf);
          const result = await emitNfAutomatico(nf.id, { timeoutMs: 30_000 });
          if (!result?.ok || result.status !== "processando") {
            throw new Error(result?.error ?? result?.message ?? "Focus não aceitou a emissão");
          }
          ok += 1;
        } catch (e) {
          erros.push(`${nf.pacienteNome ?? nf.destinatarioNome}: ${errorMessage(e)}`);
        }
        setBulkProgress({ done: i + 1, total: notas.length });
      }

      return { ok, erros };
    },
    onSuccess: ({ ok, erros }) => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      setSelectedNfIds(new Set());
      setBulkTargetNfs([]);
      setConfirmBulkEmitNfs(false);

      if (erros.length === 0) {
        toast.success(`${ok} nota${ok > 1 ? "s" : ""} enviada${ok > 1 ? "s" : ""} à Focus`);
      } else if (ok > 0) {
        toast.message(`${ok} emitida${ok > 1 ? "s" : ""}, ${erros.length} com erro`, {
          description: erros.slice(0, 3).join(" · "),
        });
      } else {
        toast.error("Nenhuma NF emitida", { description: erros.slice(0, 3).join(" · ") });
      }
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
    onSettled: () => setBulkProgress(null),
  });

  const bulkBusy = bulkEmitMutation.isPending || bulkEmitNfsMutation.isPending;

  function toggleSelectAllHeader() {
    if (allCobrancasSelected) {
      setSelectedCobrancaIds(new Set());
      return;
    }
    setSelectedCobrancaIds(new Set(aEmitir.map((row) => row.cobrancaId)));
  }

  function toggleSelectAllNfsHeader() {
    if (allNfsFocusSelected) {
      setSelectedNfIds(new Set());
      return;
    }
    setSelectedNfIds(new Set(nfsFocusPendentes.map((nf) => nf.id)));
  }

  function toggleNfSelection(nfId: string, checked: boolean) {
    setSelectedNfIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(nfId);
      else next.delete(nfId);
      return next;
    });
  }

  function abrirConfirmBulkEmitNfs() {
    if (selectedNfs.length === 0) return;
    setBulkTargetNfs(selectedNfs);
    setConfirmBulkEmitNfs(true);
  }

  function abrirConfirmBulkEmit() {
    if (selectedCobrancas.length === 0) return;
    if (selectedCobrancasElegiveis.length === 0) {
      toast.error("Nenhuma cobrança selecionada pode ir à Focus", {
        description: "Complete o CPF/CNPJ no cadastro do paciente (Pacientes → editar).",
      });
      return;
    }
    if (selectedCobrancasElegiveis.length < selectedCobrancas.length) {
      toast.message(
        `${selectedCobrancas.length - selectedCobrancasElegiveis.length} sem CPF/CNPJ serão ignoradas`,
      );
    }
    setBulkTargetCobrancas(selectedCobrancasElegiveis);
    setConfirmBulkEmit(true);
  }

  function toggleRowSelection(cobrancaId: string, checked: boolean) {
    setSelectedCobrancaIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(cobrancaId);
      else next.delete(cobrancaId);
      return next;
    });
  }

  function abrirEmitir(row?: CobrancaSemNf) {
    setPrefill(row ?? null);
    setModalEmitir(true);
  }

  const nfStats = useMemo(() => {
    const emitidas = nfs.filter((n) => n.status === "emitida").length;
    const pendentes = nfs.filter(
      (n) => n.status === "pendente" || n.status === "processando",
    ).length;
    const erros = nfs.filter((n) => n.status === "erro").length;
    return {
      total: nfs.length,
      emitidas,
      pendentes,
      erros,
      aEmitir: aEmitir.length,
    };
  }, [nfs, aEmitir.length]);

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Financeiro" }, { label: "Notas Fiscais" }]}
        title="Notas Fiscais"
        description="Emissão, acompanhamento e envio de notas fiscais"
        actions={
          <Button
            size="sm"
            className="bg-cb-cyan-600 hover:bg-cb-cyan-700"
            onClick={() => abrirEmitir()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Emitir NF
          </Button>
        }
      />

      <KpiGrid columns={5}>
        <KpiCard
          label="Total registradas"
          value={nfStats.total}
          accent="cyan"
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          label="Emitidas"
          value={nfStats.emitidas}
          accent="lime"
          icon={<CheckCircle2 className="h-5 w-5" />}
          share={nfStats.total > 0 ? (nfStats.emitidas / nfStats.total) * 100 : 0}
        />
        <KpiCard
          label="Pendentes"
          value={nfStats.pendentes}
          accent="orange"
          icon={<Clock className="h-5 w-5" />}
        />
        <KpiCard
          label="Com erro"
          value={nfStats.erros}
          accent="magenta"
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <KpiCard
          label="A emitir"
          value={nfStats.aEmitir}
          accent="purple"
          icon={<Plus className="h-5 w-5" />}
          hint="Cobranças sem NF"
        />
      </KpiGrid>

      {(nfStats.total > 0 || nfStats.aEmitir > 0) && (
        <StatusDistributionBar
          totalLabel="Status das notas registradas"
          formatValue={(n) => String(n)}
          segments={[
            { label: "Emitidas", value: nfStats.emitidas, colorClass: "bg-cb-lime" },
            { label: "Pendentes", value: nfStats.pendentes, colorClass: "bg-cb-orange" },
            { label: "Erro", value: nfStats.erros, colorClass: "bg-cb-magenta" },
          ]}
        />
      )}

      <DataToolbar>
        <DataToolbarSearch>
          <Search className="h-4 w-4 shrink-0 text-cb-muted" />
          <Input
            placeholder="Buscar por paciente, nº ou destinatário…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </DataToolbarSearch>
        <Select
          value={filtroStatus || FILTRO_TODOS}
          onValueChange={(v) => setFiltroStatus(v === FILTRO_TODOS ? "" : (v as NfStatus))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODOS}>Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="processando">Processando</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
        <CompetenciaFilterChip
          value={filtroComp}
          onChange={setFiltroComp}
          extraOptions={[{ value: FILTRO_TODAS_COMP, label: "Todas" }]}
        />
        <Select
          value={filtroTipo || FILTRO_TODOS}
          onValueChange={(v) => setFiltroTipo(v === FILTRO_TODOS ? "" : (v as PacienteTipo))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODOS}>Todos</SelectItem>
            <SelectItem value="particular">Particular</SelectItem>
            <SelectItem value="convenio">Convênio</SelectItem>
            <SelectItem value="judicial">Judicial</SelectItem>
            <SelectItem value="puc">PUC</SelectItem>
          </SelectContent>
        </Select>
        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFiltroStatus("");
              setFiltroTipo("");
              setFiltroComp(compDefault);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </DataToolbar>

      {query.isPending && !query.data ? (
        <LoadingState />
      ) : query.isError ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Erro ao carregar notas"
          description={
            query.error instanceof Error ? query.error.message : "Tente recarregar a página."
          }
        />
      ) : nfs.length === 0 && aEmitir.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Sem notas fiscais"
          description="Emita a primeira nota fiscal ou verifique cobranças pendentes de NF."
          action={
            <Button size="sm" onClick={() => abrirEmitir()}>
              <Plus className="h-4 w-4 mr-1" />
              Emitir NF
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <DashboardSection
            eyebrow="Emissão"
            accent="orange"
            title="A emitir"
            badge={
              <DashboardSectionBadge accent="orange">
                {semNfQuery.isPending && !semNfQuery.data
                  ? "…"
                  : compMes && compAno
                    ? `${MESES_ABREV[compMes - 1]}/${compAno}`
                    : `${aEmitir.length} sem NF`}
              </DashboardSectionBadge>
            }
            description="Selecione cobranças sem NF e emita em lote via Focus. Use o filtro de competência acima para outro mês."
            actions={
              selectedCobrancas.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">
                    {selectedCobrancas.length} selecionada
                    {selectedCobrancas.length > 1 ? "s" : ""}
                    {selectedCobrancasElegiveis.length < selectedCobrancas.length && (
                      <span className="text-destructive">
                        {" "}
                        ({selectedCobrancasElegiveis.length} elegível
                        {selectedCobrancasElegiveis.length > 1 ? "eis" : ""})
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    disabled={bulkBusy || selectedCobrancasElegiveis.length === 0}
                    onClick={abrirConfirmBulkEmit}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${bulkBusy ? "animate-spin" : ""}`} />
                    {bulkProgress
                      ? `Emitindo ${bulkProgress.done}/${bulkProgress.total}…`
                      : "Emitir selecionadas"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={bulkBusy}
                    onClick={() => setSelectedCobrancaIds(new Set())}
                  >
                    Limpar
                  </Button>
                </div>
              ) : undefined
            }
            noPadding
          >
            {semNfQuery.data && aEmitirSemDocumento > 0 && (
              <p className="border-b border-border/60 bg-[#FFF7ED]/50 px-6 py-2 text-xs font-medium text-destructive">
                {aEmitirSemDocumento} de {aEmitir.length} sem CPF/CNPJ no cadastro — dá para
                selecionar, mas só emite após completar o cadastro em Pacientes.
              </p>
            )}
            {semNfQuery.isError && (
              <p className="border-b border-border/60 bg-destructive/5 px-6 py-2 text-xs font-medium text-destructive">
                Erro ao carregar fila:{" "}
                {semNfQuery.error instanceof Error ? semNfQuery.error.message : "Falha na consulta"}
              </p>
            )}
            {semNfQuery.data &&
              !semNfQuery.isError &&
              aEmitir.length === 0 &&
              compMes &&
              compAno && (
                <p className="border-b border-border/60 bg-[#FFF7ED]/50 px-6 py-2 text-xs font-medium text-cb-orange">
                  Nenhuma cobrança sem NF nesta competência — troque o mês no filtro (ex.:
                  Jun/2026).
                </p>
              )}
            {semNfQuery.isPending && !semNfQuery.data ? (
              <div className="px-4 py-6">
                <LoadingState />
              </div>
            ) : aEmitir.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Nenhuma linha para selecionar nesta competência.
                {compSugestoes
                  .filter((o) => o.value !== filtroComp)
                  .slice(0, 1)
                  .map((o) => (
                    <Button
                      key={o.value}
                      variant="link"
                      className="h-auto p-0 ml-1 text-sm"
                      onClick={() => setFiltroComp(o.value)}
                    >
                      Ver {o.label}
                    </Button>
                  ))}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="h-4 w-4 rounded border border-primary accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        checked={allCobrancasSelected}
                        onChange={toggleSelectAllHeader}
                        disabled={aEmitir.length === 0 || bulkBusy}
                        aria-label="Selecionar todas as cobranças"
                      />
                    </TableHead>
                    <TableHead className="w-24">Nº</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aEmitir.map((row) => (
                    <LinhaAEmitir
                      key={row.cobrancaId}
                      row={row}
                      selected={selectedCobrancaIds.has(row.cobrancaId)}
                      onSelectedChange={(checked) => toggleRowSelection(row.cobrancaId, checked)}
                      selectionDisabled={bulkBusy}
                      onEmitir={() => abrirEmitir(row)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </DashboardSection>

          {nfsFocusPendentes.length > 0 && (
            <DashboardSection
              eyebrow="Integração"
              accent="cyan"
              title="Aguardando Focus"
              badge={
                <DashboardSectionBadge accent="cyan">
                  {nfsFocusPendentes.length} pendente{nfsFocusPendentes.length > 1 ? "s" : ""}
                </DashboardSectionBadge>
              }
              description="NF já criada no sistema; selecione e envie em lote à Focus NFe."
              actions={
                selectedNfs.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium">
                      {selectedNfs.length} selecionada{selectedNfs.length > 1 ? "s" : ""}
                    </span>
                    <Button size="sm" disabled={bulkBusy} onClick={abrirConfirmBulkEmitNfs}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${bulkBusy ? "animate-spin" : ""}`} />
                      {bulkProgress
                        ? `Emitindo ${bulkProgress.done}/${bulkProgress.total}…`
                        : "Enviar à Focus"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={bulkBusy}
                      onClick={() => setSelectedNfIds(new Set())}
                    >
                      Limpar
                    </Button>
                  </div>
                ) : undefined
              }
              noPadding
            >
              <p className="px-6 py-3 text-sm text-cb-muted">
                Use a lista de notas emitidas abaixo para selecionar e enviar à Focus.
              </p>
            </DashboardSection>
          )}

          <DashboardSection
            eyebrow="Notas fiscais"
            accent="purple"
            title="Emitidas"
            badge={
              grupos.length > 0 ? (
                <DashboardSectionBadge accent="purple">
                  {nfs.length} nota{nfs.length > 1 ? "s" : ""}
                </DashboardSectionBadge>
              ) : undefined
            }
            actions={
              grupos.length > 0 ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenGroups(grupos.map((g) => g.key))}
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
                    Expandir tudo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOpenGroups([])}>
                    <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />
                    Recolher tudo
                  </Button>
                </div>
              ) : undefined
            }
            noPadding
          >
            <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups}>
              {grupos.map((grupo) => (
                <AccordionItem
                  key={grupo.key}
                  value={grupo.key}
                  className="border-b last:border-b-0"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 data-[state=open]:bg-muted/30">
                    <div className="flex items-center justify-between flex-1 gap-2 pr-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {grupo.temErro && (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className="font-medium truncate">{grupo.label}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {grupo.nfs.length} nota{grupo.nfs.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums shrink-0">
                        {brl(grupo.total)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {nfsFocusPendentes.length > 0 && (
                            <TableHead className="w-10 pl-4">
                              <input
                                ref={selectAllNfRef}
                                type="checkbox"
                                className="h-4 w-4 rounded border border-primary accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                checked={allNfsFocusSelected}
                                onChange={toggleSelectAllNfsHeader}
                                disabled={nfsFocusPendentes.length === 0 || bulkBusy}
                                aria-label="Selecionar todas pendentes de Focus"
                              />
                            </TableHead>
                          )}
                          <TableHead
                            className={nfsFocusPendentes.length > 0 ? "w-24" : "w-24 pl-4"}
                          >
                            Nº
                          </TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Emissão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="w-10" aria-label="Detalhes" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grupo.nfs.map((nf) => (
                          <NFRow
                            key={nf.id}
                            nf={nf}
                            hidePaciente
                            selectable={nfsFocusPendentes.length > 0}
                            selected={selectedNfIds.has(nf.id)}
                            onSelectedChange={(checked) => toggleNfSelection(nf.id, checked)}
                            selectionDisabled={bulkBusy}
                            onOpen={() => setDetailNf(nf)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </DashboardSection>
        </div>
      )}

      <ModalEmitirNF
        open={modalEmitir}
        onClose={() => {
          setModalEmitir(false);
          setPrefill(null);
        }}
        prefill={prefill}
      />

      <AlertDialog
        open={confirmBulkEmit}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) {
            setConfirmBulkEmit(false);
            setBulkTargetCobrancas([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Emitir {bulkTargetCobrancas.length} nota{bulkTargetCobrancas.length > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Serão criadas e enviadas à Focus NFe em sequência ({bulkTargetCobrancas.length}{" "}
              cobrança
              {bulkTargetCobrancas.length > 1 ? "s" : ""}). CPF/CNPJ e telefone vêm do cadastro do
              paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancelar</AlertDialogCancel>
            <Button
              disabled={bulkBusy || bulkTargetCobrancas.length === 0}
              onClick={() => bulkEmitMutation.mutate(bulkTargetCobrancas)}
            >
              {bulkBusy ? "Emitindo…" : "Confirmar emissão"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmBulkEmitNfs}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) {
            setConfirmBulkEmitNfs(false);
            setBulkTargetNfs([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Enviar {bulkTargetNfs.length} NF{bulkTargetNfs.length > 1 ? "s" : ""} à Focus?
            </AlertDialogTitle>
            <AlertDialogDescription>
              As notas selecionadas serão sincronizadas com o cadastro (CPF/telefone) e enviadas à
              Focus NFe em sequência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancelar</AlertDialogCancel>
            <Button
              disabled={bulkBusy || bulkTargetNfs.length === 0}
              onClick={() => bulkEmitNfsMutation.mutate(bulkTargetNfs)}
            >
              {bulkBusy ? "Enviando…" : "Confirmar envio"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NotaFiscalDetailSheet nf={detailNf} onClose={() => setDetailNf(null)} />
    </DashboardPage>
  );
}
