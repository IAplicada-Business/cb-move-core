import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import type { StatusAgendamento } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda · CB MOVE" }] }),
  component: AgendaPage,
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA = [1, 2, 3, 4, 5]; // seg-sex

const STATUS_COLORS: Record<StatusAgendamento, string> = {
  agendado: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100",
  confirmado: "bg-[#F7FEE7] text-cb-lime border-[#BEF264]",
  realizado: "bg-muted text-muted-foreground border-border",
  faltou: "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8]",
  cancelado: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
};

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day; // move to monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatHHMM(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(d: Date) {
  return `${DIAS_PT[d.getDay()]} ${d.getDate()}`;
}

// Hour slots 8h – 20h
const HOURS: number[] = [];
for (let h = 8; h <= 20; h++) HOURS.push(h);

// ─── types ───────────────────────────────────────────────────────────────────

type Agendamento = {
  id: string;
  paciente_id: string | null;
  fisioterapeuta_id: string | null;
  inicio: string;
  duracao_min: number;
  servico: string | null;
  status: StatusAgendamento;
  pacientes?: { nome: string } | null;
  fisioterapeutas?: { nome: string } | null;
};

type Fisio = { id: string; nome: string };
type Paciente = { id: string; nome: string };

// ─── queries ─────────────────────────────────────────────────────────────────

async function fetchAgendamentos(inicioSemana: string, fimSemana: string): Promise<Agendamento[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*, pacientes(nome), fisioterapeutas(nome)")
    .gte("inicio", inicioSemana)
    .lte("inicio", fimSemana)
    .order("inicio");
  if (error) throw error;
  return (data ?? []) as unknown as Agendamento[];
}

async function fetchFisios(): Promise<Fisio[]> {
  const { data, error } = await supabase.from("fisioterapeutas").select("id, nome").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchPacientes(): Promise<Paciente[]> {
  const { data, error } = await supabase.from("pacientes").select("id, nome").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

async function createAgendamento(input: {
  paciente_id: string;
  fisioterapeuta_id: string;
  inicio: string;
  duracao_min: number;
  servico: string | null;
}): Promise<void> {
  const { error } = await supabase.from("agendamentos").insert({
    ...input,
    status: "agendado",
  });
  if (error) throw error;
}

async function updateStatus(id: string, status: StatusAgendamento): Promise<void> {
  const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
  if (error) throw error;
}

// ─── schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  pacienteId: z.string().min(1, "Selecione um paciente"),
  fisioId: z.string().min(1, "Selecione um fisioterapeuta"),
  data: z.string().min(1, "Data obrigatória"),
  horaInicio: z.string().min(1, "Hora obrigatória"),
  duracao: z.coerce.number().min(15),
  servico: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── page ────────────────────────────────────────────────────────────────────

function AgendaPage() {
  const qc = useQueryClient();
  const today = new Date();
  const [semanaBase, setSemanaBase] = useState(() => startOfWeek(today));
  const [filterFisio, setFilterFisio] = useState<string>("todos");
  const [selectedAgend, setSelectedAgend] = useState<Agendamento | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const inicioSemana = toDateStr(semanaBase);
  const fimSemana = toDateStr(addDays(semanaBase, 6)) + "T23:59:59";

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: queryKeys.agendamentos.semana(inicioSemana),
    queryFn: () => fetchAgendamentos(inicioSemana, fimSemana),
  });

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: fetchFisios,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: queryKeys.pacientes.all,
    queryFn: fetchPacientes,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: "",
      fisioId: "",
      data: toDateStr(today),
      horaInicio: "08:00",
      duracao: 60,
      servico: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (vals: FormValues) =>
      createAgendamento({
        paciente_id: vals.pacienteId,
        fisioterapeuta_id: vals.fisioId,
        inicio: `${vals.data}T${vals.horaInicio}:00`,
        duracao_min: vals.duracao,
        servico: vals.servico || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos.semana(inicioSemana) });
      toast.success("Agendamento criado");
      form.reset({
        pacienteId: "",
        fisioId: "",
        data: toDateStr(today),
        horaInicio: "08:00",
        duracao: 60,
        servico: "",
      });
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusAgendamento }) =>
      updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos.semana(inicioSemana) });
      toast.success("Status atualizado");
      setSelectedAgend(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter
  const filtered = filterFisio === "todos"
    ? agendamentos
    : agendamentos.filter((a) => a.fisioterapeuta_id === filterFisio);

  // Build week days (Mon–Fri)
  const weekDays = DIAS_SEMANA.map((offset) => addDays(semanaBase, offset - 1));

  // Map agendamentos to grid — all appointments starting within this hour
  function getAgendamentosForSlot(day: Date, hour: number): Agendamento[] {
    const dayStr = toDateStr(day);
    return filtered.filter((a) => {
      const inicio = new Date(a.inicio);
      return toDateStr(inicio) === dayStr && inicio.getHours() === hour;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSemanaBase(addDays(semanaBase, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {semanaBase.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} –{" "}
            {addDays(semanaBase, 4).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setSemanaBase(addDays(semanaBase, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={filterFisio} onValueChange={setFilterFisio}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Fisioterapeuta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {fisios.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="grid min-w-[700px]" style={{ gridTemplateColumns: "60px repeat(5, 1fr)" }}>
            {/* Header row */}
            <div className="border-b border-r p-2 bg-muted/30" />
            {weekDays.map((day, i) => (
              <div key={i} className="border-b border-r p-2 text-center text-sm font-medium bg-muted/30">
                {formatDayLabel(day)}
              </div>
            ))}

            {/* Hour rows */}
            {HOURS.map((hour) => (
              <>
                <div key={`h-${hour}`} className="border-b border-r p-1 text-xs text-muted-foreground text-right pr-2 pt-2">
                  {hour}:00
                </div>
                {weekDays.map((day, di) => {
                  const slots = getAgendamentosForSlot(day, hour);
                  return (
                    <div
                      key={`${hour}-${di}`}
                      className="border-b border-r min-h-[48px] p-0.5 space-y-0.5"
                    >
                      {slots.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAgend(a)}
                          className={cn(
                            "w-full text-left px-1.5 py-0.5 rounded text-xs border truncate",
                            STATUS_COLORS[a.status]
                          )}
                        >
                          <span className="font-medium truncate block">
                            {a.pacientes?.nome ?? "—"}
                          </span>
                          <span className="text-[10px] opacity-70">
                            {formatHHMM(new Date(a.inicio))}
                            {a.duracao_min ? ` · ${a.duracao_min}min` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!selectedAgend} onOpenChange={(o) => { if (!o) setSelectedAgend(null); }}>
        <SheetContent>
          {selectedAgend && (
            <>
              <SheetHeader>
                <SheetTitle>Agendamento</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Paciente</p>
                  <p className="font-medium">{selectedAgend.pacientes?.nome ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fisioterapeuta</p>
                  <p className="font-medium">{selectedAgend.fisioterapeutas?.nome ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="font-medium">
                    {formatHHMM(new Date(selectedAgend.inicio))} · {selectedAgend.duracao_min}min
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", STATUS_COLORS[selectedAgend.status])}>
                    {STATUS_LABEL[selectedAgend.status]}
                  </span>
                </div>
                {selectedAgend.servico && (
                  <div>
                    <p className="text-xs text-muted-foreground">Serviço</p>
                    <p>{selectedAgend.servico}</p>
                  </div>
                )}

                <div className="pt-4 flex flex-col gap-2">
                  {selectedAgend.status !== "confirmado" && selectedAgend.status !== "realizado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => statusMutation.mutate({ id: selectedAgend.id, status: "confirmado" })}
                    >
                      Confirmar
                    </Button>
                  )}
                  {selectedAgend.status !== "realizado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => statusMutation.mutate({ id: selectedAgend.id, status: "realizado" })}
                    >
                      Marcar como realizado
                    </Button>
                  )}
                  {selectedAgend.status !== "faltou" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => statusMutation.mutate({ id: selectedAgend.id, status: "faltou" })}
                    >
                      Marcar faltou
                    </Button>
                  )}
                  {selectedAgend.status !== "cancelado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => statusMutation.mutate({ id: selectedAgend.id, status: "cancelado" })}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* New agendamento modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="pacienteId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {pacientes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="fisioId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fisioterapeuta *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {fisios.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="data" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="horaInicio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora início *</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="duracao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração (min)</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {[30, 45, 60, 90].map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="servico" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de sessão</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="Ex: Fisioterapia neurológica" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando…" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
