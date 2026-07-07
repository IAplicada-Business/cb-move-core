import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DollarSign, Clock, AlertTriangle, CheckCircle2, Plus, Search,
  MoreHorizontal, Upload, X, CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

import { KpiCard } from "@/components/domain/KpiCard";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries";
import { brl, formatDate } from "@/lib/format";
import {
  fetchCobrancas, createCobranca, marcarComoPago, updateCobranca,
  type Cobranca,
} from "@/lib/queries/cobrancas";
import { fetchFinanceiroKpis } from "@/lib/queries/financeiro";
import { fetchPacientes } from "@/lib/queries/pacientes";
import type { CobrancaStatus, FormaPagamento, PacienteTipo, RegimeCobranca } from "@/lib/types";
import {
  parseCSVBradesco, parseOFX, matchTransacoesComCobrancas,
  type MatchCobranca,
} from "@/lib/extrato-parser";

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças · CB MOVE" }] }),
  component: CobrancasPage,
});

// ─── helpers ────────────────────────────────────────────────────────────────

const MESES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function mesAbrev(mes: number | null, ano: number | null) {
  if (!mes || !ano) return "—";
  return `${MESES_ABREV[mes - 1]}/${ano}`;
}

function formaPgtoLabel(f: FormaPagamento | null) {
  if (!f) return "—";
  const map: Record<FormaPagamento, string> = {
    boleto: "Boleto",
    deposito: "Depósito",
    transferencia: "Transferência",
    alvara_judicial: "Alvará judicial",
    convenio_direto: "Convênio direto",
  };
  return map[f] ?? f;
}

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
  formaPagamento: z.enum(["boleto", "deposito", "transferencia", "alvara_judicial", "convenio_direto"] as const),
  vencimento: z.string().min(1, "Informe o vencimento"),
  status: z.enum([
    "pendente", "pago", "atrasado", "cancelado", "vencido",
    "aguardando_convenio", "aguardando_alvara", "regularizar_retroativa",
  ] as const),
  observacoes: z.string().optional(),
});

type NovaCobrancaForm = z.infer<typeof novaCobrancaSchema>;

const marcarPagoSchema = z.object({
  pagoEm: z.string().min(1, "Informe a data de pagamento"),
});

type MarcarPagoForm = z.infer<typeof marcarPagoSchema>;

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
    },
  });

  const watchPacienteId = form.watch("pacienteId");
  const pacienteSelecionado = pacientes.data?.find(p => p.id === watchPacienteId);

  // auto-preenche campos ao selecionar paciente
  if (pacienteSelecionado) {
    const curr = form.getValues();
    if (curr.tipo !== pacienteSelecionado.tipo) {
      form.setValue("tipo", pacienteSelecionado.tipo);
    }
    if (curr.regime !== pacienteSelecionado.regimeCobranca) {
      form.setValue("regime", pacienteSelecionado.regimeCobranca);
    }
    if (!curr.valor && pacienteSelecionado.valorMensal) {
      form.setValue("valor", pacienteSelecionado.valorMensal);
    }
    if (!curr.formaPagamento && pacienteSelecionado.formaPagamentoPreferida) {
      form.setValue("formaPagamento", pacienteSelecionado.formaPagamentoPreferida);
    }
  }

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
        observacoes: data.observacoes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      toast.success("Cobrança criada com sucesso");
      form.reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
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
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
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

            {/* Tipo e Regime */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valor e Forma de pagamento */}
            <div className="grid grid-cols-2 gap-3">
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
              <FormField
                control={form.control}
                name="formaPagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de pagamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="deposito">Depósito</SelectItem>
                        <SelectItem value="transferencia">Transferência / PIX</SelectItem>
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
                    <FormControl><Input type="date" {...field} /></FormControl>
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
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="atrasado">Atrasado</SelectItem>
                        <SelectItem value="aguardando_convenio">Aguard. convênio</SelectItem>
                        <SelectItem value="aguardando_alvara">Aguard. alvará</SelectItem>
                        <SelectItem value="regularizar_retroativa">Regularizar retroativa</SelectItem>
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
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
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
  onClose,
}: {
  cobranca: Cobranca | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const form = useForm<MarcarPagoForm>({
    resolver: zodResolver(marcarPagoSchema),
    defaultValues: { pagoEm: new Date().toISOString().split("T")[0] },
  });

  const mutation = useMutation({
    mutationFn: (data: MarcarPagoForm) => marcarComoPago(cobranca!.id, data.pagoEm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      toast.success("Cobrança marcada como paga");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!cobranca} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar como pago</DialogTitle>
        </DialogHeader>
        {cobranca && (
          <div className="text-sm text-muted-foreground mb-2">
            <span className="font-medium text-foreground">{cobranca.pacienteNome}</span>
            {" — "}{brl(cobranca.valor)}
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="pagoEm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do pagamento</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Confirmar pagamento"}
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
    reader.onload = ev => {
      const content = ev.target?.result as string;
      const transacoes = file.name.toLowerCase().endsWith(".ofx")
        ? parseOFX(content)
        : parseCSVBradesco(content);

      const cobSimples = cobrancas.map(c => ({
        id: c.id,
        pacienteNome: c.pacienteNome ?? "",
        valor: c.valor,
        vencimento: c.vencimento ?? "",
        status: c.status,
      }));

      const result = matchTransacoesComCobrancas(transacoes, cobSimples);
      setMatches(result);
      setSelecionados(new Set(result.filter(m => m.confianca === "alta").map(m => m.cobrancaId)));
      setProcessando(false);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  const confirmarMutation = useMutation({
    mutationFn: async () => {
      const sel = matches.filter(m => selecionados.has(m.cobrancaId));
      await Promise.all(sel.map(m => marcarComoPago(m.cobrancaId, m.transacao.data)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      toast.success(`${selecionados.size} cobrança(s) marcada(s) como pagas`);
      resetExtrato();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleSel(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { resetExtrato(); onClose(); } }}>
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
              <input ref={fileRef} type="file" accept=".csv,.ofx" className="hidden" onChange={handleFile} />
              {matches.length > 0 && (
                <span className="text-xs text-muted-foreground">{matches.length} match(es) encontrado(s)</span>
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
                {matches.map(m => (
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
                        onClick={e => e.stopPropagation()}
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
          <Button type="button" variant="outline" onClick={() => { resetExtrato(); onClose(); }}>
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

// ─── Linha da tabela ──────────────────────────────────────────────────────────

function CobrancaRow({
  cobranca: c,
  onMarcarPago,
}: {
  cobranca: Cobranca;
  onMarcarPago: () => void;
}) {
  const qc = useQueryClient();

  const emitirBoleto = useMutation({
    mutationFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.functions.invoke("emit-boleto-cora", {
        body: { cobranca_id: c.id },
      });
      if (error) throw new Error("Integração Cora não configurada ainda");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: () => updateCobranca(c.id, { status: "cancelado" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cobrancas.all });
      toast.success("Cobrança cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{c.pacienteNome ?? "—"}</TableCell>
      <TableCell><TipoBadge value={c.tipo} /></TableCell>
      <TableCell className="text-sm">{mesAbrev(c.competenciaMes, c.competenciaAno)}</TableCell>
      <TableCell className="text-sm">{formaPgtoLabel(c.formaPagamento)}</TableCell>
      <TableCell className="text-sm">{formatDate(c.vencimento)}</TableCell>
      <TableCell><StatusBadge value={c.status} /></TableCell>
      <TableCell className="text-right font-medium tabular-nums">{brl(c.valor)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {c.status !== "pago" && (
              <DropdownMenuItem onClick={onMarcarPago}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marcar como pago
              </DropdownMenuItem>
            )}
            {c.formaPagamento === "boleto" && (
              <DropdownMenuItem onClick={() => emitirBoleto.mutate()}>
                <Upload className="h-4 w-4 mr-2" />
                Emitir boleto Cora
              </DropdownMenuItem>
            )}
            {c.status !== "cancelado" && (
              <DropdownMenuItem
                onClick={() => cancelar.mutate()}
                className="text-destructive focus:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar cobrança
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function CobrancasPage() {
  const now = new Date();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<CobrancaStatus | "">("");
  const [filtroFormaPgto, setFiltroFormaPgto] = useState<FormaPagamento | "">("");
  const [filtroComp, setFiltroComp] = useState<string>("");
  const [modalNova, setModalNova] = useState(false);
  const [marcarPago, setMarcarPago] = useState<Cobranca | null>(null);
  const [modalExtrato, setModalExtrato] = useState(false);

  const compOpts = competenciaOpcoes();
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

  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  const kpisQuery = useQuery({
    queryKey: queryKeys.financeiro.kpis(anoAtual, mesAtual),
    queryFn: () => fetchFinanceiroKpis(mesAtual, anoAtual),
  });

  const kpis = kpisQuery.data ?? { total: 0, pago: 0, pendente: 0, vencido: 0 };
  const cobrancas = query.data ?? [];
  const temFiltro = !!(search || filtroStatus || filtroFormaPgto || filtroComp);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
          <p className="text-sm text-muted-foreground">Gestão de faturamento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalExtrato(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Extrato Bradesco
          </Button>
          <Button size="sm" onClick={() => setModalNova(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova cobrança
          </Button>
        </div>
      </header>

      {/* KPIs (mês corrente) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total do mês"
          value={brl(kpis.total)}
          accent="cyan"
          icon={<DollarSign className="h-4 w-4 text-cb-cyan-600" />}
          hint={`${MESES_ABREV[now.getMonth()]}/${now.getFullYear()}`}
        />
        <KpiCard
          label="Pago"
          value={brl(kpis.pago)}
          accent="lime"
          icon={<CheckCircle2 className="h-4 w-4" style={{ color: "var(--cb-lime)" }} />}
        />
        <KpiCard
          label="Pendente"
          value={brl(kpis.pendente)}
          accent="orange"
          icon={<Clock className="h-4 w-4 text-cb-orange" />}
        />
        <KpiCard
          label="Vencido"
          value={brl(kpis.vencido)}
          accent="magenta"
          icon={<AlertTriangle className="h-4 w-4 text-cb-magenta" />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={filtroComp} onValueChange={setFiltroComp}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os meses</SelectItem>
            {compOpts.map(o => (
              <SelectItem key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtroStatus}
          onValueChange={v => setFiltroStatus(v as CobrancaStatus | "")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os status</SelectItem>
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
          value={filtroFormaPgto}
          onValueChange={v => setFiltroFormaPgto(v as FormaPagamento | "")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Forma pgto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as formas</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
            <SelectItem value="deposito">Depósito</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
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
      ) : cobrancas.length === 0 ? (
        <EmptyState
          title="Sem cobranças"
          description={
            temFiltro
              ? "Nenhuma cobrança para os filtros selecionados."
              : "Crie a primeira cobrança com o botão acima."
          }
          action={
            !temFiltro ? (
              <Button size="sm" onClick={() => setModalNova(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nova cobrança
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Forma pgto</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobrancas.map(c => (
                <CobrancaRow
                  key={c.id}
                  cobranca={c}
                  onMarcarPago={() => setMarcarPago(c)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modais */}
      <ModalNovaCobranca open={modalNova} onClose={() => setModalNova(false)} />
      <ModalMarcarPago cobranca={marcarPago} onClose={() => setMarcarPago(null)} />
      <ModalExtrato
        open={modalExtrato}
        onClose={() => setModalExtrato(false)}
        cobrancas={cobrancas}
      />
    </div>
  );
}
