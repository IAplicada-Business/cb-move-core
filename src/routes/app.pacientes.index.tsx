import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, MoreHorizontal, Users, UserCheck, Briefcase, Scale } from "lucide-react";
import { toast } from "sonner";

import { KpiCard } from "@/components/domain/KpiCard";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { CampoDiasSemana, CampoFrequenciaAtendimento } from "@/components/domain/AtendimentoCadastroFields";
import { queryKeys } from "@/lib/queries";
import { formatPhone } from "@/lib/format";
import {
  fetchPacientes,
  createPaciente,
  updatePaciente,
  deletePaciente,
  setPacienteAtivo,
  type Paciente,
} from "@/lib/queries/pacientes";
import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo } from "@/lib/types";

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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/pacientes/")({
  head: () => ({ meta: [{ title: "Pacientes · CB MOVE" }] }),
  component: PacientesPage,
});

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cpf: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").nullable().optional().or(z.literal("")),
  tipo: z.enum(["particular", "judicial", "convenio", "puc"] as const),
  regimeCobranca: z.enum(["mensalista", "por_sessao"] as const),
  valorMensal: z.string().nullable().optional().refine(
    (v) => !v || /^\d+([.,]\d{1,2})?$/.test(v),
    "Valor inválido",
  ),
  valorSessao: z.string().nullable().optional().refine(
    (v) => !v || /^\d+([.,]\d{1,2})?$/.test(v),
    "Valor inválido",
  ),
  modeloRelatorio: z.enum(["convencional", "unimed", "sharepoint", "puc"] as const).nullable().optional(),
  convenioId: z.string().nullable().optional(),
  numeroProcesso: z.string().nullable().optional(),
  frequenciaAtendimento: z.string().nullable().optional(),
  diasSemana: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  motivoAcompanhamento: z.string().nullable().optional(),
  ativo: z.boolean(),
  endereco: z.string().nullable().optional(),
  numeroEndereco: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  uf: z.string().max(2, "UF com 2 letras").nullable().optional(),
  codigoMunicipioIbge: z.string().nullable().optional().refine(
    (v) => !v || /^\d{7}$/.test(v),
    "Código IBGE com 7 dígitos",
  ),
});

type FormValues = z.infer<typeof schema>;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function parseValorBr(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function maskCPF(cpf: string | null | undefined) {
  if (!cpf) return "—";
  const v = cpf.replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  const part3 = v.slice(6, 9);
  const part4 = v.slice(9, 11);
  return `***.***.${part3}-${part4}`;
}

async function fetchConvenios() {
  const { data, error } = await supabase.from("convenios").select("id, nome").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

function PacientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<PacienteTipo | "todos">("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Paciente | null>(null);
  const [deleting, setDeleting] = useState<Paciente | null>(null);

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: queryKeys.pacientes.list({ search, tipo: filterTipo === "todos" ? undefined : filterTipo }),
    queryFn: () =>
      fetchPacientes({
        search: search || undefined,
        tipo: filterTipo === "todos" ? undefined : filterTipo,
      }),
  });

  const { data: convenios = [] } = useQuery({
    queryKey: ["convenios", "ativos"],
    queryFn: fetchConvenios,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      cpf: "",
      telefone: "",
      email: "",
      tipo: "particular",
      regimeCobranca: "mensalista",
      modeloRelatorio: null,
      convenioId: null,
      numeroProcesso: null,
      frequenciaAtendimento: "",
      diasSemana: "",
      observacoes: "",
      motivoAcompanhamento: "",
      ativo: true,
      endereco: "",
      numeroEndereco: "",
      complemento: "",
      bairro: "",
      cep: "",
      cidade: "",
      uf: "",
      codigoMunicipioIbge: "",
      valorMensal: "",
      valorSessao: "",
    },
  });

  const tipoWatch = form.watch("tipo");
  const regimeWatch = form.watch("regimeCobranca");

  const mutation = useMutation({
    mutationFn: async (vals: FormValues) => {
      const payload = {
        nome: vals.nome,
        cpf: vals.cpf || null,
        telefone: vals.telefone || null,
        email: vals.email || null,
        tipo: vals.tipo,
        regimeCobranca: vals.regimeCobranca,
        modeloRelatorio: vals.modeloRelatorio ?? null,
        convenioId: vals.convenioId || null,
        numeroProcesso: vals.numeroProcesso || null,
        frequenciaAtendimento: vals.frequenciaAtendimento?.trim() || null,
        diasSemana: vals.diasSemana?.trim() || null,
        observacoes: vals.observacoes || null,
        motivoAcompanhamento: vals.motivoAcompanhamento?.trim() || null,
        ativo: vals.ativo,
        valorMensal: parseValorBr(vals.valorMensal),
        valorSessao: parseValorBr(vals.valorSessao),
        fisioterapeutaId: null,
        advogadoNome: null,
        advogadoEmail: null,
        formaPagamentoPreferida: null,
        endereco: vals.endereco?.trim() || null,
        numeroEndereco: vals.numeroEndereco?.trim() || null,
        complemento: vals.complemento?.trim() || null,
        bairro: vals.bairro?.trim() || null,
        cep: vals.cep?.trim() ? onlyDigits(vals.cep) : null,
        cidade: vals.cidade?.trim() || null,
        uf: vals.uf?.trim().toUpperCase() || null,
        codigoMunicipioIbge: vals.codigoMunicipioIbge?.trim() ? Number(vals.codigoMunicipioIbge.trim()) : null,
      };
      if (editing) {
        await updatePaciente(editing.id, payload);
      } else {
        await createPaciente(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.all });
      qc.invalidateQueries({ queryKey: ["financeiro", "extrato"] });
      toast.success(editing ? "Paciente atualizado" : "Paciente criado");
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => setPacienteAtivo(id, ativo),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pacientes.all }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaciente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.all });
      toast.success("Paciente excluído");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    form.reset({
      nome: "",
      cpf: "",
      telefone: "",
      email: "",
      tipo: "particular",
      regimeCobranca: "mensalista",
      modeloRelatorio: null,
      convenioId: null,
      numeroProcesso: null,
      frequenciaAtendimento: "",
      diasSemana: "",
      observacoes: "",
      motivoAcompanhamento: "",
      ativo: true,
      endereco: "",
      numeroEndereco: "",
      complemento: "",
      bairro: "",
      cep: "",
      cidade: "",
      uf: "",
      codigoMunicipioIbge: "",
      valorMensal: "",
      valorSessao: "",
    });
    setModalOpen(true);
  }

  function openEdit(p: Paciente) {
    setEditing(p);
    form.reset({
      nome: p.nome,
      cpf: p.cpf ?? "",
      telefone: p.telefone ?? "",
      email: p.email ?? "",
      tipo: p.tipo,
      regimeCobranca: p.regimeCobranca,
      modeloRelatorio: p.modeloRelatorio ?? null,
      convenioId: p.convenioId ?? null,
      numeroProcesso: p.numeroProcesso ?? null,
      frequenciaAtendimento: p.frequenciaAtendimento ?? "",
      diasSemana: p.diasSemana ?? "",
      observacoes: p.observacoes ?? "",
      motivoAcompanhamento: p.motivoAcompanhamento ?? "",
      ativo: p.ativo,
      endereco: p.endereco ?? "",
      numeroEndereco: p.numeroEndereco ?? "",
      complemento: p.complemento ?? "",
      bairro: p.bairro ?? "",
      cep: p.cep ?? "",
      cidade: p.cidade ?? "",
      uf: p.uf ?? "",
      codigoMunicipioIbge: p.codigoMunicipioIbge != null ? String(p.codigoMunicipioIbge) : "",
      valorMensal: p.valorMensal != null ? String(p.valorMensal).replace(".", ",") : "",
      valorSessao: p.valorSessao != null ? String(p.valorSessao).replace(".", ",") : "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  const total = pacientes.length;
  const nParticular = pacientes.filter((p) => p.tipo === "particular").length;
  const nConvenio = pacientes.filter((p) => p.tipo === "convenio").length;
  const nJudicial = pacientes.filter((p) => p.tipo === "judicial").length;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo paciente
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total" value={total} accent="cyan" icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Particular" value={nParticular} accent="cyan" icon={<UserCheck className="h-4 w-4" />} />
        <KpiCard label="Convênio" value={nConvenio} accent="purple" icon={<Briefcase className="h-4 w-4" />} />
        <KpiCard label="Judicial" value={nJudicial} accent="magenta" icon={<Scale className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as PacienteTipo | "todos")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="particular">Particular</SelectItem>
            <SelectItem value="convenio">Convênio</SelectItem>
            <SelectItem value="judicial">Judicial</SelectItem>
            <SelectItem value="puc">PUC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : pacientes.length === 0 ? (
        <EmptyState
          title="Nenhum paciente encontrado"
          description="Crie o primeiro paciente ou ajuste os filtros."
          action={<Button onClick={openNew} variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Novo paciente</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Convênio / Processo</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Modelo relatório</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacientes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/app/pacientes/$pacienteId"
                      params={{ pacienteId: p.id }}
                      className="text-cb-cyan-800 hover:underline"
                    >
                      {p.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{maskCPF(p.cpf)}</TableCell>
                  <TableCell><TipoBadge value={p.tipo} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.convenioNome ?? p.numeroProcesso ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{formatPhone(p.telefone) || "—"}</TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">
                    {p.modeloRelatorio ?? "convencional"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.ativo}
                        onCheckedChange={(v) => toggleAtivoMutation.mutate({ id: p.id, ativo: v })}
                      />
                      <span className={cn("text-xs", p.ativo ? "text-[#047857]" : "text-muted-foreground")}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/app/pacientes/$pacienteId" params={{ pacienteId: p.id }}>
                            Ver ficha
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(p)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleting(p)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar paciente" : "Novo paciente"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="cpf" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="000.000.000-00" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="telefone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="(51) 99999-0000" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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
                )} />

                <FormField control={form.control} name="regimeCobranca" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="mensalista">Mensalista</SelectItem>
                        <SelectItem value="por_sessao">Por sessão</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {regimeWatch === "mensalista" ? (
                <FormField control={form.control} name="valorMensal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor mensal (R$)</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="1028,00" inputMode="decimal" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ) : (
                <FormField control={form.control} name="valorSessao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor por sessão (R$)</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="150,00" inputMode="decimal" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="modeloRelatorio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo de relatório</FormLabel>
                  <Select value={field.value ?? "convencional"} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="convencional">Convencional</SelectItem>
                      <SelectItem value="unimed">Unimed</SelectItem>
                      <SelectItem value="sharepoint">SharePoint (judicial)</SelectItem>
                      <SelectItem value="puc">PUC</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {tipoWatch === "convenio" && (
                <FormField control={form.control} name="convenioId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Convênio</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {convenios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {(tipoWatch === "judicial" || tipoWatch === "puc") && (
                <FormField control={form.control} name="numeroProcesso" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do processo</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {tipoWatch === "particular" && (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Endereço — obrigatório para emissão automática da NF (tomador particular)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="endereco" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} placeholder="Rua Exemplo" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="numeroEndereco" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} placeholder="123" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="complemento" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} placeholder="Apto 101" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bairro" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="cep" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} placeholder="00000-000" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cidade" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="uf" render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} maxLength={2} placeholder="RS" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="codigoMunicipioIbge" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código município IBGE</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} placeholder="4314902" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Atendimento — usado no extrato financeiro mensal
                </p>
                <FormField control={form.control} name="frequenciaAtendimento" render={({ field }) => (
                  <CampoFrequenciaAtendimento field={field} />
                )} />
                <FormField control={form.control} name="diasSemana" render={({ field }) => (
                  <CampoDiasSemana field={field} />
                )} />
              </div>

              <FormField control={form.control} name="motivoAcompanhamento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo do acompanhamento</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      placeholder="Por que este paciente está em tratamento na clínica (diagnóstico, indicação, etc.)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="observacoes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome}</strong>? Só é possível excluir
              pacientes sem histórico de cobranças, sessões ou agendamentos. Caso já tenha
              histórico, use o botão de status na tabela para inativá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
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
