import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { FilterChip } from "@/components/domain/FilterChip";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries";
import {
  fetchAgendamentoHistorico,
  remarcarAgendamento,
  updateAgendamentoStatus,
  type EscopoRemanejamento,
  type HistoricoRow,
} from "@/lib/queries/agenda";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo, StatusAgendamento } from "@/lib/types";

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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { formatDateDDMMYY, formatDateTimeDDMMYY } from "@/lib/format";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda · CB MOVE" }] }),
  component: AgendaPage,
});

// ─── constants ───────────────────────────────────────────────────────────────

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA = [1, 2, 3, 4, 5];
const FILTRO_TODOS = "todos";
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type VisaoAgenda = "semana" | "dia" | "mes";

const TIPO_SLOT: Record<PacienteTipo, string> = {
  particular: "bg-cb-cyan-600/10 text-cb-cyan-800 border-l-[3px] border-l-cb-cyan-600",
  judicial: "bg-cb-magenta/10 text-cb-magenta border-l-[3px] border-l-cb-magenta",
  convenio: "bg-cb-purple/10 text-cb-purple border-l-[3px] border-l-cb-purple",
  puc: "bg-cb-orange/10 text-cb-orange border-l-[3px] border-l-cb-orange",
};

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  faltou: "Faltou",
  cancelado: "Cancelado",
  remarcacao: "Remarcação",
};

const HOURS: number[] = [];
for (let h = 8; h <= 20; h++) HOURS.push(h);

// ─── helpers ─────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHHMM(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeader(d: Date) {
  return `${DIAS_PT[d.getDay()]} ${d.getDate()}`;
}

function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function fisioFirstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

type WeekBlock = { label: string; days: Date[] };

function weeksInMonth(year: number, monthIndex: number): WeekBlock[] {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const blocks: WeekBlock[] = [];
  let weekNum = 1;
  let day = 1;

  while (day <= lastDay) {
    const days: Date[] = [];
    while (day <= lastDay && new Date(year, monthIndex, day).getDay() !== 1 && days.length === 0) {
      day++;
    }
    while (day <= lastDay && days.length < 5) {
      const d = new Date(year, monthIndex, day);
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) days.push(d);
      day++;
      if (dow === 5) break;
    }
    if (days.length > 0) {
      const start = days[0];
      const end = days[days.length - 1];
      blocks.push({
        label: `Semana ${weekNum} — ${start.getDate()} a ${end.getDate()} ${MESES[monthIndex].slice(0, 3)}`,
        days,
      });
      weekNum++;
    }
  }
  return blocks;
}

// ─── types & queries ─────────────────────────────────────────────────────────

type Agendamento = {
  id: string;
  paciente_id: string | null;
  fisioterapeuta_id: string | null;
  inicio: string;
  duracao_min: number;
  servico: string | null;
  status: StatusAgendamento;
  serie_id?: string | null;
  pacientes?: { nome: string; tipo: PacienteTipo } | null;
  fisioterapeutas?: { nome: string } | null;
};

type Fisio = { id: string; nome: string };
type Paciente = { id: string; nome: string };

async function fetchAgendamentosPeriodo(inicio: string, fim: string): Promise<Agendamento[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*, pacientes(nome, tipo), fisioterapeutas(nome)")
    .gte("inicio", inicio)
    .lte("inicio", fim)
    .order("inicio");
  if (error) throw error;
  return (data ?? []) as unknown as Agendamento[];
}

async function fetchFisios(): Promise<Fisio[]> {
  const { data, error } = await supabase
    .from("fisioterapeutas")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchPacientes(): Promise<Paciente[]> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
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
  const { error } = await supabase.from("agendamentos").insert({ ...input, status: "agendado" });
  if (error) throw error;
}

async function updateStatus(
  id: string,
  status: StatusAgendamento,
  usuarioId?: string | null,
  statusAnterior?: StatusAgendamento,
): Promise<void> {
  await updateAgendamentoStatus(id, status, usuarioId, statusAnterior);
}

// ─── slot UI ─────────────────────────────────────────────────────────────────

function AgendaSlot({
  ag,
  onClick,
  className,
  interactive = true,
}: {
  ag: Agendamento;
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
}) {
  const tipo = ag.pacientes?.tipo ?? "particular";
  const fisio = fisioFirstName(ag.fisioterapeutas?.nome ?? "—");
  const dimmed =
    ag.status === "realizado" ||
    ag.status === "cancelado" ||
    ag.status === "remarcacao";
  const cls = cn(
    "w-full rounded-md px-2 py-1 text-left text-[11.5px] leading-tight",
    TIPO_SLOT[tipo],
    dimmed && "opacity-55",
    interactive && "transition-all hover:-translate-y-px hover:shadow-sm",
    className,
  );

  const content = (
    <>
      <span className="block truncate font-bold">{shortName(ag.pacientes?.nome ?? "—")}</span>
      <span className="block truncate opacity-80">
        {fisio} · {ag.duracao_min}min
      </span>
    </>
  );

  if (!interactive) return <div className={cls}>{content}</div>;

  return (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}

function TipoLegend() {
  const items: { tipo: PacienteTipo; label: string; color: string }[] = [
    { tipo: "particular", label: "Particular", color: "bg-cb-cyan-600" },
    { tipo: "judicial", label: "Judicial", color: "bg-cb-magenta" },
    { tipo: "convenio", label: "Convênio", color: "bg-cb-purple" },
    { tipo: "puc", label: "PUC", color: "bg-cb-orange" },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-[11.5px] text-muted-foreground">
      {items.map(({ tipo, label, color }) => (
        <span key={tipo} className="inline-flex items-center gap-1.5 font-medium">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", color)} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── form ────────────────────────────────────────────────────────────────────

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

type RemarcarFormValues = {
  data: string;
  horaInicio: string;
  fisioId: string;
  duracao: number;
  escopo: EscopoRemanejamento;
};

function AgendaPage() {
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const podeGerir = can.manageAgenda(roles);
  const today = new Date();
  const [semanaBase, setSemanaBase] = useState(() => startOfWeek(today));
  const [mesRef, setMesRef] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [visao, setVisao] = useState<VisaoAgenda>("semana");
  const [filterFisio, setFilterFisio] = useState(FILTRO_TODOS);
  const [filterTipo, setFilterTipo] = useState(FILTRO_TODOS);
  const [selectedAgend, setSelectedAgend] = useState<Agendamento | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [remarcarOpen, setRemarcarOpen] = useState(false);
  const [remarcarTarget, setRemarcarTarget] = useState<Agendamento | null>(null);

  const periodo = useMemo(() => {
    if (visao === "mes") {
      const y = mesRef.getFullYear();
      const m = mesRef.getMonth();
      const inicio = toDateStr(new Date(y, m, 1));
      const fim = toDateStr(new Date(y, m + 1, 0)) + "T23:59:59";
      return { inicio, fim };
    }
    const inicio = toDateStr(semanaBase);
    const fim = toDateStr(addDays(semanaBase, 6)) + "T23:59:59";
    return { inicio, fim };
  }, [visao, semanaBase, mesRef]);

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: queryKeys.agendamentos.periodo(periodo.inicio, periodo.fim),
    queryFn: () => fetchAgendamentosPeriodo(periodo.inicio, periodo.fim),
  });

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: fetchFisios,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: queryKeys.pacientes.all,
    queryFn: fetchPacientes,
  });

  const remarcarForm = useForm<RemarcarFormValues>({
    defaultValues: {
      data: toDateStr(today),
      horaInicio: "09:00",
      fisioId: "",
      duracao: 50,
      escopo: "pontual",
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["agendamento-historico", selectedAgend?.id],
    queryFn: () => fetchAgendamentoHistorico(selectedAgend!.id),
    enabled: !!selectedAgend?.id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: "",
      fisioId: "",
      data: toDateStr(today),
      horaInicio: "08:00",
      duracao: 50,
      servico: "Fisioterapia neurológica",
    },
  });

  const invalidateAgenda = () => {
    qc.invalidateQueries({ queryKey: queryKeys.agendamentos.all });
  };

  const createMutation = useMutation({
    mutationFn: (vals: FormValues) =>
      createAgendamento({
        paciente_id: vals.pacienteId,
        fisioterapeuta_id: vals.fisioId,
        inicio: `${vals.data}T${vals.horaInicio}:00-03:00`,
        duracao_min: vals.duracao,
        servico: vals.servico || null,
      }),
    onSuccess: () => {
      invalidateAgenda();
      toast.success("Agendamento criado");
      form.reset({
        pacienteId: "",
        fisioId: "",
        data: toDateStr(today),
        horaInicio: "08:00",
        duracao: 50,
        servico: "Fisioterapia neurológica",
      });
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, anterior }: { id: string; status: StatusAgendamento; anterior: StatusAgendamento }) =>
      updateStatus(id, status, user?.id ?? null, anterior),
    onSuccess: () => {
      invalidateAgenda();
      qc.invalidateQueries({ queryKey: ["agendamento-historico"] });
      toast.success("Status atualizado");
      setSelectedAgend(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remarcarMutation = useMutation({
    mutationFn: (vals: RemarcarFormValues & { agendamentoId: string }) =>
      remarcarAgendamento({
        agendamentoId: vals.agendamentoId,
        novoInicio: `${vals.data}T${vals.horaInicio}:00-03:00`,
        novoFisioId: vals.fisioId || undefined,
        duracaoMin: vals.duracao,
        escopo: vals.escopo,
        usuarioId: user?.id ?? null,
      }),
    onSuccess: async (result) => {
      invalidateAgenda();
      qc.invalidateQueries({ queryKey: ["agendamento-historico"] });
      toast.success(result.count > 1 ? `${result.count} horários remarcados` : "Agendamento remarcado");
      setRemarcarOpen(false);
      setRemarcarTarget(null);

      if (result.primeiroNovoId) {
        const { data, error } = await supabase
          .from("agendamentos")
          .select("*, pacientes(nome, tipo), fisioterapeutas(nome)")
          .eq("id", result.primeiroNovoId)
          .single();
        if (!error && data) {
          setSelectedAgend(data as unknown as Agendamento);
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () =>
      agendamentos
        .filter((a) => a.status !== "remarcacao")
        .filter((a) => {
        if (filterFisio !== FILTRO_TODOS && a.fisioterapeuta_id !== filterFisio) return false;
        if (filterTipo !== FILTRO_TODOS && a.pacientes?.tipo !== filterTipo) return false;
        return true;
      }),
    [agendamentos, filterFisio, filterTipo],
  );

  function abrirRemarcar(ag: Agendamento) {
    const d = new Date(ag.inicio);
    remarcarForm.reset({
      data: toDateStr(d),
      horaInicio: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }),
      fisioId: ag.fisioterapeuta_id ?? "",
      duracao: ag.duracao_min,
      escopo: "pontual",
    });
    setRemarcarTarget(ag);
    setRemarcarOpen(true);
  }

  function labelHistorico(item: HistoricoRow) {
    if (item.acao === "remanejamento") {
      const de = item.inicio_anterior ? formatDateTimeDDMMYY(item.inicio_anterior) : "—";
      const para = item.inicio_novo ? formatDateTimeDDMMYY(item.inicio_novo) : "—";
      return `Remanejamento (${item.escopo ?? "pontual"}): ${de} → ${para}`;
    }
    return `Status: ${item.status_anterior ?? "—"} → ${item.status_novo ?? "—"}`;
  }

  const weekDays = DIAS_SEMANA.map((offset) => addDays(semanaBase, offset - 1));
  const monthWeeks = useMemo(
    () => weeksInMonth(mesRef.getFullYear(), mesRef.getMonth()),
    [mesRef],
  );

  function agendamentosNoDia(day: Date) {
    const dayStr = toDateStr(day);
    return filtered
      .filter((a) => toDateStr(new Date(a.inicio)) === dayStr)
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  }

  function getAgendamentosForSlot(day: Date, hour: number) {
    const dayStr = toDateStr(day);
    return filtered.filter((a) => {
      const inicio = new Date(a.inicio);
      return toDateStr(inicio) === dayStr && inicio.getHours() === hour;
    });
  }

  const fisioOptions = [
    { value: FILTRO_TODOS, label: "Todos" },
    ...fisios.map((f) => ({ value: f.id, label: f.nome })),
  ];

  const tipoOptions = [
    { value: FILTRO_TODOS, label: "Todos" },
    { value: "particular", label: "Particular" },
    { value: "judicial", label: "Judicial" },
    { value: "convenio", label: "Convênio" },
    { value: "puc", label: "PUC" },
  ];

  const visaoOptions = [
    { value: "semana", label: "Semana" },
    { value: "dia", label: "Lista por dia" },
    { value: "mes", label: "Mês" },
  ];

  const headerTitle =
    visao === "mes"
      ? `Agenda · ${MESES[mesRef.getMonth()]}/${mesRef.getFullYear()}`
      : `Agenda · Semana de ${semanaBase.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

  function navBack() {
    if (visao === "mes") {
      setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1));
    } else {
      setSemanaBase(addDays(semanaBase, -7));
    }
  }

  function navForward() {
    if (visao === "mes") {
      setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1));
    } else {
      setSemanaBase(addDays(semanaBase, 7));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Operação <span className="opacity-50">›</span> Agenda
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{headerTitle}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={navBack}>
            <ChevronLeft className="h-4 w-4" />
            {visao === "mes" ? "Mês ant." : "Semana ant."}
          </Button>
          <Button variant="outline" size="sm" onClick={navForward}>
            {visao === "mes" ? "Próx. mês" : "Próx. semana"}
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-4 py-3">
        <FilterChip prefix="Fisio" value={filterFisio} options={fisioOptions} onChange={setFilterFisio} />
        <FilterChip prefix="Tipo" value={filterTipo} options={tipoOptions} onChange={setFilterTipo} />
        <div className="ml-auto">
          <FilterChip prefix="Visão" value={visao} options={visaoOptions} onChange={(v) => setVisao(v as VisaoAgenda)} />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={visao === "mes" ? "Mês sem agendamentos" : "Semana sem agendamentos"}
          description="Crie um novo agendamento para preencher a agenda."
          action={
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          }
        />
      ) : visao === "semana" ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <div
            className="grid min-w-[700px] gap-px bg-border"
            style={{ gridTemplateColumns: "60px repeat(5, 1fr)" }}
          >
            <div className="bg-muted/30 p-2" />
            {weekDays.map((day, i) => (
              <div
                key={i}
                className="bg-cb-cyan-050 p-3 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {formatDayHeader(day)}
              </div>
            ))}

            {HOURS.map((hour) => (
              <Fragment key={hour}>
                <div className="bg-muted/40 p-2 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {hour}:00
                </div>
                {weekDays.map((day, di) => (
                  <div key={`${hour}-${di}`} className="min-h-[60px] space-y-1 bg-card p-1.5">
                    {getAgendamentosForSlot(day, hour).map((a) => (
                      <AgendaSlot
                        key={a.id}
                        ag={a}
                        onClick={() => setSelectedAgend(a)}
                      />
                    ))}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      ) : visao === "dia" ? (
        <div className="space-y-4">
          {weekDays.map((day) => {
            const items = agendamentosNoDia(day);
            if (items.length === 0) return null;
            return (
              <section key={toDateStr(day)} className="rounded-xl border bg-card overflow-hidden">
                <header className="border-b bg-cb-cyan-050 px-4 py-3">
                  <h2 className="text-sm font-bold text-cb-cyan-800">
                    {day.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </h2>
                </header>
                <ul className="divide-y">
                  {items.map((a) => (
                    <li
                      key={a.id}
                      className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-muted/40"
                      onClick={() => setSelectedAgend(a)}
                    >
                      <span className="w-14 shrink-0 font-mono text-sm font-semibold text-muted-foreground">
                        {formatHHMM(new Date(a.inicio))}
                      </span>
                      <div className="min-w-0 flex-1">
                        <AgendaSlot ag={a} interactive={false} className="max-w-md" />
                      </div>
                      <StatusBadge kind="agenda" value={a.status} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {monthWeeks.map((week) => {
            const weekHasItems = week.days.some((d) => agendamentosNoDia(d).length > 0);
            if (!weekHasItems) return null;
            return (
              <section key={week.label} className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{week.label}</h2>
                {week.days.map((day) => {
                  const items = agendamentosNoDia(day);
                  if (items.length === 0) return null;
                  return (
                    <div key={toDateStr(day)} className="rounded-xl border bg-card overflow-hidden">
                      <header className="border-b bg-muted/30 px-4 py-2.5">
                        <h3 className="text-sm font-semibold text-foreground">
                          {day.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
                        </h3>
                      </header>
                      <ul className="divide-y">
                        {items.map((a) => (
                          <li
                            key={a.id}
                            className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-muted/40"
                            onClick={() => setSelectedAgend(a)}
                          >
                            <span className="w-14 shrink-0 font-mono text-sm font-semibold text-muted-foreground">
                              {formatHHMM(new Date(a.inicio))}
                            </span>
                            <div className="min-w-0 flex-1">
                              <AgendaSlot ag={a} interactive={false} className="max-w-md" />
                            </div>
                            <StatusBadge kind="agenda" value={a.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {!isLoading && filtered.length > 0 && <TipoLegend />}

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
                  {selectedAgend.pacientes?.tipo && (
                    <div className="mt-1"><TipoBadge value={selectedAgend.pacientes.tipo} /></div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fisioterapeuta</p>
                  <p className="font-medium">{selectedAgend.fisioterapeutas?.nome ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="font-medium">
                    {formatDateTimeDDMMYY(selectedAgend.inicio)}
                    {" · "}
                    {selectedAgend.duracao_min}min
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge kind="agenda" value={selectedAgend.status} />
                </div>
                {selectedAgend.servico && (
                  <div>
                    <p className="text-xs text-muted-foreground">Serviço</p>
                    <p>{selectedAgend.servico}</p>
                  </div>
                )}

                {podeGerir && ["agendado", "confirmado"].includes(selectedAgend.status) && (
                  <div className="pt-4 space-y-2 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Fluxo de status
                    </p>
                    {selectedAgend.status === "agendado" && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          statusMutation.mutate({
                            id: selectedAgend.id,
                            status: "confirmado",
                            anterior: selectedAgend.status,
                          })
                        }
                      >
                        Confirmar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() =>
                        statusMutation.mutate({
                          id: selectedAgend.id,
                          status: "cancelado",
                          anterior: selectedAgend.status,
                        })
                      }
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => abrirRemarcar(selectedAgend)}
                    >
                      Remarcar
                    </Button>
                  </div>
                )}

                {podeGerir && ["agendado", "confirmado"].includes(selectedAgend.status) && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Registro de sessão
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        statusMutation.mutate({
                          id: selectedAgend.id,
                          status: "realizado",
                          anterior: selectedAgend.status,
                        })
                      }
                    >
                      Marcar como realizado
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        statusMutation.mutate({
                          id: selectedAgend.id,
                          status: "faltou",
                          anterior: selectedAgend.status,
                        })
                      }
                    >
                      Marcar faltou
                    </Button>
                  </div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Histórico
                  </p>
                  {historico.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
                  ) : (
                    <ul className="space-y-2">
                      {historico.map((h) => (
                        <li key={h.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                          <p className="font-medium text-foreground">{labelHistorico(h)}</p>
                          <p className="text-muted-foreground">
                            {formatDateTimeDDMMYY(h.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={remarcarOpen} onOpenChange={(o) => { setRemarcarOpen(o); if (!o) setRemarcarTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remarcar agendamento</DialogTitle>
          </DialogHeader>
          {remarcarTarget && (
            <form
              className="space-y-4"
              onSubmit={remarcarForm.handleSubmit((vals) =>
                remarcarMutation.mutate({ ...vals, agendamentoId: remarcarTarget.id }),
              )}
            >
              <p className="text-sm text-muted-foreground">
                {remarcarTarget.pacientes?.nome ?? "Paciente"} · novo horário
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="remarcar-data">Nova data</Label>
                  <Input id="remarcar-data" type="date" {...remarcarForm.register("data")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="remarcar-hora">Nova hora</Label>
                  <Input id="remarcar-hora" type="time" {...remarcarForm.register("horaInicio")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Fisioterapeuta</Label>
                <Select
                  value={remarcarForm.watch("fisioId")}
                  onValueChange={(v) => remarcarForm.setValue("fisioId", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {fisios.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Escopo do remanejamento</Label>
                <RadioGroup
                  value={remarcarForm.watch("escopo")}
                  onValueChange={(v) => remarcarForm.setValue("escopo", v as EscopoRemanejamento)}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="pontual" id="escopo-pontual" />
                    <Label htmlFor="escopo-pontual" className="font-normal">Só este horário</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="semana"
                      id="escopo-semana"
                      disabled={!remarcarTarget.serie_id}
                    />
                    <Label htmlFor="escopo-semana" className={cn("font-normal", !remarcarTarget.serie_id && "opacity-50")}>
                      Demais futuros da mesma semana (série)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="serie_mes"
                      id="escopo-mes"
                      disabled={!remarcarTarget.serie_id}
                    />
                    <Label htmlFor="escopo-mes" className={cn("font-normal", !remarcarTarget.serie_id && "opacity-50")}>
                      Demais futuros da série até fim do mês
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRemarcarOpen(false)}>
                  Voltar
                </Button>
                <Button type="submit" disabled={remarcarMutation.isPending}>
                  {remarcarMutation.isPending ? "Salvando…" : "Confirmar remarcação"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
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
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger></FormControl>
                    <SelectContent className="max-h-60">
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
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger></FormControl>
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
                      {[30, 45, 50, 60, 90].map((d) => (
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
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Ex: Fisioterapia neurológica" />
                  </FormControl>
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
