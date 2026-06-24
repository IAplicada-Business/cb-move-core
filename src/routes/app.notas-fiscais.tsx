import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, MoreHorizontal, FileText, X, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries";
import { brl, formatDate } from "@/lib/format";
import { fetchNFs, createNF, type NotaFiscal } from "@/lib/queries/notas-fiscais";
import { fetchPacientes, type Paciente } from "@/lib/queries/pacientes";
import type { NfStatus, PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export const Route = createFileRoute("/app/notas-fiscais")({
  head: () => ({ meta: [{ title: "Notas Fiscais · CB MOVE" }] }),
  component: NotasFiscaisPage,
});

// ─── helpers ────────────────────────────────────────────────────────────────

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
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

// Retorna destinatário default conforme tipo
function destinatarioPadraoNome(paciente: Paciente | undefined): string {
  if (!paciente) return "";
  if (paciente.tipo === "particular" || paciente.tipo === "puc") return paciente.nome;
  // judicial/convenio: será preenchido manualmente ou autopreenchido com o convênio
  return "";
}

// ─── schema ──────────────────────────────────────────────────────────────────

const emitirNFSchema = z.object({
  pacienteId: z.string().min(1, "Selecione o paciente"),
  competenciaMes: z.coerce.number().min(1).max(12),
  competenciaAno: z.coerce.number().min(2020).max(2100),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  destinatarioNome: z.string().min(1, "Informe o destinatário"),
  destinatarioDocumento: z.string().optional(),
  // campos judiciais
  corpoPacienteNome: z.string().optional(),
  corpoPacienteCpf: z.string().optional(),
  corpoNumeroProcesso: z.string().optional(),
  corpoTotalSessoes: z.coerce.number().optional(),
});

type EmitirNFForm = z.infer<typeof emitirNFSchema>;

// ─── Modal Emitir NF ─────────────────────────────────────────────────────────

function ModalEmitirNF({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const now = new Date();

  const pacientes = useQuery({
    queryKey: queryKeys.pacientes.list(),
    queryFn: () => fetchPacientes({ ativo: true }),
    enabled: open,
  });

  const form = useForm<EmitirNFForm>({
    resolver: zodResolver(emitirNFSchema),
    defaultValues: {
      competenciaMes: now.getMonth() + 1,
      competenciaAno: now.getFullYear(),
    },
  });

  const watchPacienteId = form.watch("pacienteId");
  const pacienteSelecionado = pacientes.data?.find(p => p.id === watchPacienteId);
  const isJudicial = pacienteSelecionado?.tipo === "judicial";

  // auto-preenche destinatário ao selecionar paciente (executa só quando pacienteId muda)
  useEffect(() => {
    if (!pacienteSelecionado) return;
    const nomeAuto = destinatarioPadraoNome(pacienteSelecionado);
    if (nomeAuto) form.setValue("destinatarioNome", nomeAuto);
    if (pacienteSelecionado.cpf && pacienteSelecionado.tipo === "particular") {
      form.setValue("destinatarioDocumento", pacienteSelecionado.cpf);
    } else {
      form.setValue("destinatarioDocumento", "");
    }
    if (pacienteSelecionado.valorMensal) {
      form.setValue("valor", pacienteSelecionado.valorMensal);
    }
    if (pacienteSelecionado.tipo === "judicial") {
      form.setValue("corpoPacienteNome", pacienteSelecionado.nome);
      form.setValue("corpoPacienteCpf", pacienteSelecionado.cpf ?? "");
      form.setValue("corpoNumeroProcesso", pacienteSelecionado.numeroProcesso ?? "");
    } else {
      form.setValue("corpoPacienteNome", "");
      form.setValue("corpoPacienteCpf", "");
      form.setValue("corpoNumeroProcesso", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchPacienteId]);

  const mutation = useMutation({
    mutationFn: (data: EmitirNFForm) =>
      createNF({
        pacienteId: data.pacienteId,
        tipo: (pacienteSelecionado?.tipo ?? "particular") as PacienteTipo,
        destinatarioNome: data.destinatarioNome,
        destinatarioDocumento: data.destinatarioDocumento,
        valor: data.valor,
        emissao: new Date().toISOString().split("T")[0],
        competenciaMes: data.competenciaMes,
        competenciaAno: data.competenciaAno,
        corpoPacienteNome: data.corpoPacienteNome,
        corpoPacienteCpf: data.corpoPacienteCpf,
        corpoNumeroProcesso: data.corpoNumeroProcesso,
        corpoTotalSessoes: data.corpoTotalSessoes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notasFiscais.all });
      toast.success("NF criada com sucesso");
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleClose() {
    form.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir Nota Fiscal</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
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
                        <SelectItem value="__loading" disabled>Carregando…</SelectItem>
                      )}
                      {(pacientes.data ?? []).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                          <span className="ml-2 text-xs text-muted-foreground capitalize">({p.tipo})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo — readonly, vem do paciente */}
            {pacienteSelecionado && (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Tipo: <span className="font-medium text-foreground capitalize">{pacienteSelecionado.tipo}</span>
              </div>
            )}

            {/* Competência */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="competenciaMes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês</FormLabel>
                    <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {MESES_FULL.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
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

            {/* Valor */}
            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Destinatário */}
            <FormField
              control={form.control}
              name="destinatarioNome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinatário — Nome</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destinatarioDocumento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinatário — CPF / CNPJ</FormLabel>
                  <FormControl><Input {...field} placeholder="000.000.000-00 ou 00.000.000/0001-00" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos extras para judicial */}
            {isJudicial && (
              <div className="rounded-md border border-dashed p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Corpo da NF — Judicial
                </p>
                <FormField
                  control={form.control}
                  name="corpoPacienteNome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do paciente (corpo)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="corpoPacienteCpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF do paciente</FormLabel>
                        <FormControl><Input {...field} placeholder="000.000.000-00" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corpoTotalSessoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total de sessões</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="corpoNumeroProcesso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do processo</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Emitir NF"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────

function NFRow({ nf }: { nf: NotaFiscal }) {
  const isJudicial = nf.tipo === "judicial";

  return (
    <TableRow>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {nf.numero ?? "—"}
      </TableCell>
      <TableCell className="font-medium">{nf.pacienteNome ?? "—"}</TableCell>
      <TableCell>
        <div>{nf.destinatarioNome ?? "—"}</div>
        {isJudicial && nf.corpoPacienteNome && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Corpo: {nf.corpoPacienteNome}
            {nf.corpoNumeroProcesso && ` · proc. ${nf.corpoNumeroProcesso}`}
          </div>
        )}
      </TableCell>
      <TableCell><TipoBadge value={nf.tipo} /></TableCell>
      <TableCell className="text-sm">{formatDate(nf.emissao)}</TableCell>
      <TableCell><StatusBadge kind="nf" value={nf.status} /></TableCell>
      <TableCell className="text-right font-medium tabular-nums">{brl(nf.valor)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {nf.pdfUrl && (
              <DropdownMenuItem onClick={() => window.open(nf.pdfUrl!, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver PDF
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
              Emissão Safe Notas (pendente config.)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function NotasFiscaisPage() {
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<NfStatus | "">("");
  const [filtroTipo, setFiltroTipo] = useState<PacienteTipo | "">("");
  const [filtroComp, setFiltroComp] = useState<string>("");
  const [modalEmitir, setModalEmitir] = useState(false);

  const compOpts = competenciaOpcoes();
  const compMes = filtroComp ? Number(filtroComp.split("-")[0]) : undefined;
  const compAno = filtroComp ? Number(filtroComp.split("-")[1]) : undefined;

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

  const nfs = query.data ?? [];
  const temFiltro = !!(search || filtroStatus || filtroTipo || filtroComp);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground">Gestão de notas fiscais emitidas</p>
        </div>
        <Button size="sm" onClick={() => setModalEmitir(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Emitir NF
        </Button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente, nº ou destinatário…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v as NfStatus | "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="regularizada_retroativa">Regularizada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroComp} onValueChange={setFiltroComp}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {compOpts.map(o => (
              <SelectItem key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={v => setFiltroTipo(v as PacienteTipo | "")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
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
              setFiltroComp("");
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      {query.isLoading ? (
        <LoadingState />
      ) : nfs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Sem notas fiscais"
          description={
            temFiltro
              ? "Nenhuma NF encontrada para os filtros selecionados."
              : "Emita a primeira nota fiscal com o botão acima."
          }
          action={
            !temFiltro ? (
              <Button size="sm" onClick={() => setModalEmitir(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Emitir NF
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
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
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nfs.map(nf => (
                <NFRow key={nf.id} nf={nf} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ModalEmitirNF open={modalEmitir} onClose={() => setModalEmitir(false)} />
    </div>
  );
}
