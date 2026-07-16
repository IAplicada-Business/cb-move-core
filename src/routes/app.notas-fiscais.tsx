import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, MoreHorizontal, FileText, X, ExternalLink, Mail, RefreshCw,
  ChevronsDownUp, ChevronsUpDown, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries";
import { brl, formatDate } from "@/lib/format";
import {
  fetchNFs, createNF, emitNfManual, emitNfAutomatico, sendNfEmail, updateNF, uploadNfPdf,
  type NotaFiscal,
} from "@/lib/queries/notas-fiscais";
import { fetchPacientes } from "@/lib/queries/pacientes";
import {
  criarNfDeCobranca, fetchCobrancasSemNf, resolverDestinatarioNf,
  type CobrancaSemNf,
} from "@/lib/queries/financeiro";
import type { NfStatus, PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/notas-fiscais")({
  head: () => ({ meta: [{ title: "Notas Fiscais · CB MOVE" }] }),
  component: NotasFiscaisPage,
});

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Radix Select não aceita value="" em SelectItem — use "todos" como sentinela. */
const FILTRO_TODOS = "todos";
const FILTRO_TODAS_COMP = "todas";

function competenciaOpcoes() {
  const now = new Date();
  const opts: { label: string; mes: number; ano: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ label: `${MESES_ABREV[d.getMonth()]}/${d.getFullYear()}`, mes: d.getMonth() + 1, ano: d.getFullYear() });
  }
  return opts;
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
    resolverDestinatarioNf(watchCobrancaId).then((d) => {
      form.setValue("destinatarioNome", d.destinatarioNome);
      form.setValue("destinatarioDocumento", d.destinatarioDocumento ?? "");
      form.setValue("valor", d.valor);
      form.setValue("competenciaMes", d.competenciaMes ?? form.getValues("competenciaMes"));
      form.setValue("competenciaAno", d.competenciaAno ?? form.getValues("competenciaAno"));
      if (d.corpoPacienteNome) form.setValue("corpoPacienteNome", d.corpoPacienteNome);
      if (d.corpoPacienteCpf) form.setValue("corpoPacienteCpf", d.corpoPacienteCpf);
      if (d.corpoNumeroProcesso) form.setValue("corpoNumeroProcesso", d.corpoNumeroProcesso);
      if (d.corpoTotalSessoes) form.setValue("corpoTotalSessoes", d.corpoTotalSessoes);
    }).catch((e: Error) => toast.error(e.message));
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
          throw new Error("Emissão automática exige CPF (11 dígitos) ou CNPJ (14 dígitos) do destinatário");
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPdfFile(null); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Emitir Nota Fiscal</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="pacienteId" render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!!prefill}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {(pacientes.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {pacienteSelecionado && (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                Tipo: <span className="font-medium capitalize">{pacienteSelecionado.tipo}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="competenciaMes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {MESES_FULL.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="competenciaAno" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="valor" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="destinatarioNome" render={({ field }) => (
              <FormItem>
                <FormLabel>Destinatário — Nome</FormLabel>
                <FormControl><Input {...field} readOnly={isParticular} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="destinatarioDocumento" render={({ field }) => (
              <FormItem>
                <FormLabel>Destinatário — CPF / CNPJ</FormLabel>
                <FormControl>
                  <Input {...field} readOnly={isParticular} placeholder={isParticular ? "CPF do paciente" : "000.000.000/0001-00"} />
                </FormControl>
                {isParticular && (
                  <p className="text-xs text-muted-foreground">Particular: tomador é o paciente (CPF bloqueado).</p>
                )}
              </FormItem>
            )} />

            {isJudicial && (
              <div className="rounded-md border border-dashed p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Corpo da NF — Judicial</p>
                <FormField control={form.control} name="corpoPacienteNome" render={({ field }) => (
                  <FormItem><FormLabel>Nome do paciente</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="corpoNumeroProcesso" render={({ field }) => (
                  <FormItem><FormLabel>Processo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              </div>
            )}

            <FormField control={form.control} name="modo" render={({ field }) => (
              <FormItem>
                <FormLabel>Modo de emissão</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="manual">Manual (número + PDF)</SelectItem>
                    <SelectItem value="automatico">Automático (Focus NFe)</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            {watchModo === "automatico" && (
              <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                Homologação Focus NFe — emite NFS-e Nacional POA e grava PDF no sistema. Certificado A1 já configurado no painel.
              </p>
            )}

            {watchModo === "manual" && (
              <>
                <FormField control={form.control} name="numeroNf" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número da NF</FormLabel>
                    <FormControl><Input {...field} placeholder="NF-001284" /></FormControl>
                  </FormItem>
                )} />
                <div>
                  <Label>Upload PDF</Label>
                  <Input type="file" accept=".pdf" className="mt-1" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
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


function NFRow({ nf, hidePaciente }: { nf: NotaFiscal; hidePaciente?: boolean }) {
  const qc = useQueryClient();
  const isJudicial = nf.tipo === "judicial";
  const [confirmReemitir, setConfirmReemitir] = useState(false);

  const podeFocus =
    nf.status === "erro" || nf.status === "pendente" || nf.status === "processando";

  const focusMutation = useMutation({
    mutationFn: () => emitNfAutomatico(nf.id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      if (result.status === "processando") {
        const detail =
          nf.status === "processando"
            ? `Focus: ${result.focus_status ?? "processando_autorizacao"}`
            : (result.message ?? "Aguardando autorização via webhook.");
        toast.message(
          nf.status === "processando" ? "Status consultado" : "Reemissão enviada",
          { description: detail },
        );
      } else {
        toast.success("NF atualizada na Focus");
      }
      setConfirmReemitir(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reenviar = useMutation({
    mutationFn: () => sendNfEmail(nf.id, nf.tipo),
    onSuccess: () => toast.success("E-mail enfileirado via n8n"),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: () => updateNF(nf.id, { status: "cancelada" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      toast.success("NF cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-sm text-muted-foreground">{nf.numero ?? "—"}</TableCell>
        {!hidePaciente && <TableCell className="font-medium">{nf.pacienteNome ?? "—"}</TableCell>}
        <TableCell>
          <div>{nf.destinatarioNome ?? "—"}</div>
          {isJudicial && nf.corpoPacienteNome && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Corpo: {nf.corpoPacienteNome}{nf.corpoNumeroProcesso && ` · proc. ${nf.corpoNumeroProcesso}`}
            </div>
          )}
        </TableCell>
        <TableCell><TipoBadge value={nf.tipo} /></TableCell>
        <TableCell className="text-sm">{formatDate(nf.emissao)}</TableCell>
        <TableCell><StatusBadge kind="nf" value={nf.status} /></TableCell>
        <TableCell className="text-right font-medium tabular-nums">{brl(nf.valor)}</TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            {podeFocus && (
              <Button
                size="sm"
                variant={nf.status === "erro" ? "default" : "outline"}
                className="h-8"
                disabled={focusMutation.isPending}
                onClick={() => {
                  if (nf.status === "erro") setConfirmReemitir(true);
                  else focusMutation.mutate();
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${focusMutation.isPending ? "animate-spin" : ""}`} />
                {nf.status === "erro"
                  ? "Reemitir"
                  : nf.status === "processando"
                    ? "Consultar"
                    : "Focus"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {nf.pdfUrl && (
                  <DropdownMenuItem onClick={() => window.open(nf.pdfUrl!, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-2" />Ver PDF
                  </DropdownMenuItem>
                )}
                {podeFocus && (
                  <DropdownMenuItem
                    onClick={() => {
                      if (nf.status === "erro") setConfirmReemitir(true);
                      else focusMutation.mutate();
                    }}
                    disabled={focusMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {nf.status === "erro"
                      ? "Reemitir (Focus NFe)"
                      : nf.status === "processando"
                        ? "Consultar status Focus"
                        : "Emitir automático (Focus)"}
                  </DropdownMenuItem>
                )}
                {nf.status === "emitida" && (
                  <DropdownMenuItem onClick={() => reenviar.mutate()} disabled={reenviar.isPending}>
                    <Mail className="h-4 w-4 mr-2" />Reenviar por e-mail
                  </DropdownMenuItem>
                )}
                {nf.status !== "cancelada" && nf.status !== "emitida" && (
                  <DropdownMenuItem onClick={() => cancelar.mutate()} className="text-destructive">
                    <X className="h-4 w-4 mr-2" />Cancelar NF
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmReemitir} onOpenChange={setConfirmReemitir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemitir nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              A NF de <strong>{nf.pacienteNome ?? "paciente"}</strong> ({brl(nf.valor)}) será
              reenviada à Focus NFe com a mesma referência. O status passará para
              {" "}<strong>processando</strong> até o webhook confirmar autorização ou novo erro.
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
    </>
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
        key, label, documento: nf.destinatarioDocumento ?? null,
        total: 0, temErro: false, temPendente: false, latest: nf.createdAt, nfs: [],
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

function LinhaAEmitir({ row, onEmitir }: { row: CobrancaSemNf; onEmitir: () => void }) {
  return (
    <TableRow className="bg-amber-50/50 dark:bg-amber-950/20">
      <TableCell className="font-mono text-sm text-muted-foreground">—</TableCell>
      <TableCell className="font-medium">{row.pacienteNome}</TableCell>
      <TableCell>
        <div>{row.destinatarioNome ?? "—"}</div>
        {row.destinatarioDocumento && (
          <div className="text-xs text-muted-foreground">{row.destinatarioDocumento}</div>
        )}
      </TableCell>
      <TableCell><TipoBadge value={row.tipo} /></TableCell>
      <TableCell className="text-sm">—</TableCell>
      <TableCell>
        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border-amber-200">
          A emitir
        </span>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{brl(row.valor)}</TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={onEmitir}>Emitir</Button>
      </TableCell>
    </TableRow>
  );
}

function NotasFiscaisPage() {
  const now = new Date();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<NfStatus | "">("");
  const [filtroTipo, setFiltroTipo] = useState<PacienteTipo | "">("");
  const [filtroComp, setFiltroComp] = useState(FILTRO_TODAS_COMP);
  const [modalEmitir, setModalEmitir] = useState(false);
  const [prefill, setPrefill] = useState<CobrancaSemNf | null>(null);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const compOpts = competenciaOpcoes();
  const compMes = filtroComp && filtroComp !== FILTRO_TODAS_COMP ? Number(filtroComp.split("-")[0]) : undefined;
  const compAno = filtroComp && filtroComp !== FILTRO_TODAS_COMP ? Number(filtroComp.split("-")[1]) : undefined;

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

  const semNfQuery = useQuery({
    queryKey: queryKeys.financeiro.cobrancasSemNf(compAno ?? now.getFullYear(), compMes ?? now.getMonth() + 1),
    queryFn: () => fetchCobrancasSemNf(compMes ?? now.getMonth() + 1, compAno ?? now.getFullYear()),
    enabled: !!(compMes && compAno),
  });

  const nfs = query.data ?? [];
  const aEmitir = semNfQuery.data ?? [];
  const temFiltro = !!(search || filtroStatus || filtroTipo);
  const grupos = useMemo(() => agruparPorCliente(nfs), [nfs]);

  useEffect(() => {
    setOpenGroups(search.trim() ? grupos.map((g) => g.key) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function abrirEmitir(row?: CobrancaSemNf) {
    setPrefill(row ?? null);
    setModalEmitir(true);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground">Gestão de notas fiscais emitidas</p>
        </div>
        <Button size="sm" onClick={() => abrirEmitir()}>
          <Plus className="h-4 w-4 mr-1" />Emitir NF
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por paciente, nº ou destinatário…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select
          value={filtroStatus || FILTRO_TODOS}
          onValueChange={(v) => setFiltroStatus(v === FILTRO_TODOS ? "" : (v as NfStatus))}
        >
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODOS}>Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="processando">Processando</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroComp} onValueChange={setFiltroComp}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Competência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODAS_COMP}>Todas</SelectItem>
            {compOpts.map((o) => (
              <SelectItem key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtroTipo || FILTRO_TODOS}
          onValueChange={(v) => setFiltroTipo(v === FILTRO_TODOS ? "" : (v as PacienteTipo))}
        >
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTRO_TODOS}>Todos</SelectItem>
            <SelectItem value="particular">Particular</SelectItem>
            <SelectItem value="convenio">Convênio</SelectItem>
            <SelectItem value="judicial">Judicial</SelectItem>
            <SelectItem value="puc">PUC</SelectItem>
          </SelectContent>
        </Select>
        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFiltroStatus(""); setFiltroTipo(""); }}>
            <X className="h-4 w-4 mr-1" />Limpar
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Erro ao carregar notas"
          description={query.error instanceof Error ? query.error.message : "Tente recarregar a página."}
        />
      ) : nfs.length === 0 && aEmitir.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Sem notas fiscais"
          description="Emita a primeira nota fiscal ou verifique cobranças pendentes de NF."
          action={<Button size="sm" onClick={() => abrirEmitir()}><Plus className="h-4 w-4 mr-1" />Emitir NF</Button>}
        />
      ) : (
        <div className="space-y-4">
          {aEmitir.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b bg-amber-50/80 text-sm font-semibold text-amber-900">
                A emitir — {aEmitir.length} cobrança(s) sem NF
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Nº</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aEmitir.map((row) => (
                    <LinhaAEmitir key={row.cobrancaId} row={row} onEmitir={() => abrirEmitir(row)} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {grupos.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {grupos.length} cliente{grupos.length > 1 ? "s" : ""} · {nfs.length} nota{nfs.length > 1 ? "s" : ""}
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setOpenGroups(grupos.map((g) => g.key))}>
                  <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />Expandir tudo
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOpenGroups([])}>
                  <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />Recolher tudo
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups}>
              {grupos.map((grupo) => (
                <AccordionItem key={grupo.key} value={grupo.key} className="border-b last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 data-[state=open]:bg-muted/30">
                    <div className="flex items-center justify-between flex-1 gap-2 pr-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {grupo.temErro && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        <span className="font-medium truncate">{grupo.label}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {grupo.nfs.length} nota{grupo.nfs.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums shrink-0">{brl(grupo.total)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24 pl-4">Nº</TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Emissão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grupo.nfs.map((nf) => <NFRow key={nf.id} nf={nf} hidePaciente />)}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      )}

      <ModalEmitirNF
        open={modalEmitir}
        onClose={() => { setModalEmitir(false); setPrefill(null); }}
        prefill={prefill}
      />
    </div>
  );
}
