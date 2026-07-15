import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { DateInputDDMMYY } from "@/components/domain/DateInputDDMMYY";
import { TimeInputHHMM } from "@/components/domain/TimeInputHHMM";
import { EmptyState } from "@/components/domain/EmptyState";
import { FilterChip } from "@/components/domain/FilterChip";
import { FisioHorariosDialog } from "@/components/domain/FisioHorariosDialog";
import { PacientePlanoSessoesCard } from "@/components/domain/PacientePlanoSessoesCard";
import { FrequenciaMensalGrid } from "@/components/domain/FrequenciaMensalGrid";
import { LoadingState } from "@/components/domain/LoadingState";
import {
  agendamentoNoBloco,
  BLOCOS_COUNT,
  INTERVALOS_COUNT,
  SemanaPadraoGridShell,
  SlotStatusLegend,
} from "@/components/domain/SemanaPadraoGrid";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries";
import {
  fetchAgendamentoHistorico,
  remarcarAgendamento,
  updateAgendamentoStatus,
  contarEscopoRemanejamento,
  fetchAgendaAviso,
  type EscopoRemanejamento,
  type HistoricoRow,
  upsertAgendaAviso,
} from "@/lib/queries/agenda";
import {
  fetchFisioDisponibilidade,
  fetchFisioIndisponibilidade,
} from "@/lib/queries/fisio-horarios";
import { fetchSessaoSiglaDia } from "@/lib/queries/sessoes";
import {
  fetchAgendamentosAtivosPacienteMes,
  fetchPlanoSessoesMensalPaciente,
} from "@/lib/queries/plano-sessoes";
import {
  gerarSlotsFaltantesPlano,
  montarPropostasAgendamento,
} from "@/lib/domain/padrao-agenda-mensal";
import { simularRemarcacaoImpacto } from "@/lib/domain/simular-remarcacao-impacto";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { parseSiglaHistorico, SIGLA_HINT } from "@/lib/domain/frequencia";
import type { PacienteTipo, StatusAgendamento } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatDateDDMMYY, formatDateTimeDDMMYY, isoToDDMMYY, isoToHHMM, parseDDMMYYToISO } from "@/lib/format";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda · CB MOVE" }] }),
  component: AgendaPage,
});

// ─── constants ───────────────────────────────────────────────────────────────

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const DIAS_SEMANA = [1, 2, 3, 4, 5];
const FILTRO_TODOS = "todos";
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type VisaoAgenda = "semana" | "dia" | "frequencia" | "mes";

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
  indisponivel: "Indisponível",
  ferias: "Férias",
  horario_extra: "Horário extra",
};

const STATUS_SLOT: StatusAgendamento[] = ["indisponivel", "ferias", "horario_extra"];
const STATUS_EDITAVEIS: StatusAgendamento[] = [
  "agendado",
  "confirmado",
  "indisponivel",
  "ferias",
  "horario_extra",
];

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
  return `${DIAS_PT[d.getDay()]} ${formatDateDDMMYY(d)}`;
}

function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function fisioFirstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** Cabeçalho da coluna — ex.: ADRIANO, CARLOS E., CARLOS M. */
function fisioColHeader(nome: string, todosNomes: string[]) {
  const parts = nome.trim().split(/\s+/);
  const first = (parts[0] ?? nome).toUpperCase();
  const homonimos = todosNomes.filter(
    (n) => (n.trim().split(/\s+/)[0] ?? n).toUpperCase() === first,
  );
  if (homonimos.length <= 1) return first;
  const inicial = parts[1]?.[0]?.toUpperCase();
  return inicial ? `${first} ${inicial}.` : first;
}

function indexDiaNaSemana(weekStart: Date): number {
  const hoje = toDateStr(new Date());
  const idx = DIAS_SEMANA.map((offset) => addDays(weekStart, offset - 1)).findIndex(
    (d) => toDateStr(d) === hoje,
  );
  return idx >= 0 ? idx : 0;
}

function formatAvisoDisplay(texto: string) {
  return texto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ");
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

function sameIsoWeek(a: Date, b: Date): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}

function navegarParaDataAgenda(
  isoInicio: string,
  setSemanaBase: (d: Date) => void,
  setDiaSemanaIdx: (i: number) => void,
) {
  const novaData = new Date(isoInicio);
  const ws = startOfWeek(novaData);
  setSemanaBase(ws);
  const dayStr = toDateStr(novaData);
  const idx = DIAS_SEMANA.map((offset) => addDays(ws, offset - 1)).findIndex(
    (d) => toDateStr(d) === dayStr,
  );
  if (idx >= 0) setDiaSemanaIdx(idx);
}

function formatDeltaDias(delta: number): string {
  if (delta === 0) return "mesmo dia";
  if (delta > 0) return `+${delta} dia${delta !== 1 ? "s" : ""}`;
  return `${delta} dia${delta !== -1 ? "s" : ""}`;
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
  paciente_id: string | null;
  fisioterapeuta_id: string;
  inicio: string;
  duracao_min: number;
  servico: string | null;
  status: StatusAgendamento;
  serie_id?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("agendamentos").insert(input);
  if (error) throw error;
}

async function createAgendamentosLote(
  inputs: Array<{
    paciente_id: string | null;
    fisioterapeuta_id: string;
    inicio: string;
    duracao_min: number;
    servico: string | null;
    status: StatusAgendamento;
    serie_id?: string | null;
  }>,
): Promise<number> {
  if (inputs.length === 0) return 0;
  const { error } = await supabase.from("agendamentos").insert(inputs);
  if (error) throw error;
  return inputs.length;
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
  compact = false,
}: {
  ag: Agendamento;
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
  /** Coluna já é o fisio — oculta nome do profissional no slot */
  compact?: boolean;
}) {
  const tipo = ag.pacientes?.tipo ?? "particular";
  const fisio = fisioFirstName(ag.fisioterapeutas?.nome ?? "—");
  const dimmed =
    ag.status === "realizado" ||
    ag.status === "cancelado" ||
    ag.status === "remarcacao" ||
    ag.status === "indisponivel" ||
    ag.status === "ferias" ||
    ag.status === "horario_extra";
  const cls = cn(
    "w-full rounded-md px-2 py-1 text-left text-[11.5px] leading-tight",
    TIPO_SLOT[tipo],
    dimmed && "opacity-55",
    interactive && "transition-all hover:-translate-y-px hover:shadow-sm",
    className,
  );

  const content = compact ? (
    <span className="block truncate font-bold">{shortName(ag.pacientes?.nome ?? "—")}</span>
  ) : (
    <>
      <span className="block truncate font-bold">{shortName(ag.pacientes?.nome ?? "—")}</span>
      <span className="block truncate opacity-80">
        {fisio} · {ag.duracao_min}min
      </span>
    </>
  );

  if (!interactive) return <div className={cls}>{content}</div>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cls}
    >
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

const schema = z
  .object({
    pacienteId: z.string().optional().default(""),
    fisioId: z.string().min(1, "Selecione um fisioterapeuta"),
    data: z.string().refine((v) => parseDDMMYYToISO(v) !== null, "Use dd/mm/aa"),
    horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm"),
    duracao: z.coerce.number().min(15),
    servico: z.string().nullable().optional(),
    statusSlot: z.enum(["agendado", "indisponivel", "ferias", "horario_extra"]),
    agendarSerieMesmoDia: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.statusSlot === "agendado" && !data.pacienteId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione um paciente",
        path: ["pacienteId"],
      });
    }
  });
type FormValues = z.infer<typeof schema>;

// ─── page ────────────────────────────────────────────────────────────────────

type RemarcarFormValues = {
  data: string; // dd/mm/yy
  horaInicio: string; // HH:mm
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
  const [diaSemanaIdx, setDiaSemanaIdx] = useState(() => indexDiaNaSemana(startOfWeek(today)));
  const [mesRef, setMesRef] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [visao, setVisao] = useState<VisaoAgenda>("semana");
  const [filterFisio, setFilterFisio] = useState(FILTRO_TODOS);
  const [filterTipo, setFilterTipo] = useState(FILTRO_TODOS);
  const [buscaGrade, setBuscaGrade] = useState("");
  const [selectedAgend, setSelectedAgend] = useState<Agendamento | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);
  const [remarcarOpen, setRemarcarOpen] = useState(false);
  const [remarcarTarget, setRemarcarTarget] = useState<Agendamento | null>(null);
  const [avisoDraft, setAvisoDraft] = useState("");

  const periodo = useMemo(() => {
    if (visao === "mes" || visao === "frequencia") {
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
    enabled: visao !== "frequencia",
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
      data: formatDateDDMMYY(today),
      horaInicio: "09:00",
      fisioId: "",
      duracao: 50,
      escopo: "pontual",
    },
  });

  const remarcarDataWatch = remarcarForm.watch("data");
  const remarcarHoraWatch = remarcarForm.watch("horaInicio");
  const remarcarEscopoWatch = remarcarForm.watch("escopo");

  const remarcarPreview = useMemo(() => {
    if (!remarcarTarget) return null;
    const iso = parseDDMMYYToISO(remarcarDataWatch);
    if (!iso || !/^\d{2}:\d{2}$/.test(remarcarHoraWatch)) return null;
    const novoInicio = `${iso}T${remarcarHoraWatch}:00-03:00`;
    const origem = new Date(remarcarTarget.inicio);
    const destino = new Date(novoInicio);
    const deltaDias = Math.round((destino.getTime() - origem.getTime()) / 86_400_000);
    return {
      novoInicio,
      deltaDias,
      cruzaSemana: !sameIsoWeek(origem, destino),
      destinoLabel: formatDateTimeDDMMYY(novoInicio),
    };
  }, [remarcarTarget, remarcarDataWatch, remarcarHoraWatch]);

  const { data: contagensEscopo } = useQuery({
    queryKey: ["agenda-escopo-counts", remarcarTarget?.id],
    queryFn: async () => ({
      pontual: await contarEscopoRemanejamento(remarcarTarget!.id, "pontual"),
      semana: await contarEscopoRemanejamento(remarcarTarget!.id, "semana"),
      serie_mes: await contarEscopoRemanejamento(remarcarTarget!.id, "serie_mes"),
    }),
    enabled: !!remarcarTarget && remarcarOpen,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["agendamento-historico", selectedAgend?.id],
    queryFn: () => fetchAgendamentoHistorico(selectedAgend!.id),
    enabled: !!selectedAgend?.id,
  });

  const competenciaAgend = useMemo(() => {
    if (!selectedAgend?.inicio) return null;
    const d = new Date(selectedAgend.inicio);
    return { mes: d.getMonth() + 1, ano: d.getFullYear() };
  }, [selectedAgend?.inicio]);

  const { data: planoSessoesMensal } = useQuery({
    queryKey: queryKeys.sessoes.planoMensal(
      selectedAgend?.paciente_id ?? "",
      competenciaAgend?.mes ?? 0,
      competenciaAgend?.ano ?? 0,
    ),
    queryFn: () =>
      fetchPlanoSessoesMensalPaciente(
        selectedAgend!.paciente_id!,
        competenciaAgend!.mes,
        competenciaAgend!.ano,
      ),
    enabled: !!selectedAgend?.paciente_id && !!competenciaAgend,
  });

  const dataRemarcarOrigem = remarcarTarget?.inicio.slice(0, 10) ?? "";
  const dataRemarcarDestino = useMemo(() => parseDDMMYYToISO(remarcarDataWatch) ?? "", [remarcarDataWatch]);

  const { data: siglaDiaRemarcar = null } = useQuery({
    queryKey: queryKeys.sessoes.siglaDia(remarcarTarget?.paciente_id ?? "", dataRemarcarOrigem),
    queryFn: () => fetchSessaoSiglaDia(remarcarTarget!.paciente_id!, dataRemarcarOrigem),
    enabled: remarcarOpen && !!remarcarTarget?.paciente_id && !!dataRemarcarOrigem,
  });

  const { data: siglaDiaRemarcarDestino = null } = useQuery({
    queryKey: queryKeys.sessoes.siglaDia(remarcarTarget?.paciente_id ?? "", dataRemarcarDestino),
    queryFn: () => fetchSessaoSiglaDia(remarcarTarget!.paciente_id!, dataRemarcarDestino),
    enabled:
      remarcarOpen &&
      !!remarcarTarget?.paciente_id &&
      !!dataRemarcarDestino &&
      dataRemarcarDestino !== dataRemarcarOrigem,
  });

  const competenciaRemarcar = useMemo(() => {
    if (!remarcarTarget?.inicio) return null;
    const d = new Date(remarcarTarget.inicio);
    return { mes: d.getMonth() + 1, ano: d.getFullYear() };
  }, [remarcarTarget?.inicio]);

  const { data: planoRemarcar } = useQuery({
    queryKey: queryKeys.sessoes.planoMensal(
      remarcarTarget?.paciente_id ?? "",
      competenciaRemarcar?.mes ?? 0,
      competenciaRemarcar?.ano ?? 0,
    ),
    queryFn: () =>
      fetchPlanoSessoesMensalPaciente(
        remarcarTarget!.paciente_id!,
        competenciaRemarcar!.mes,
        competenciaRemarcar!.ano,
      ),
    enabled: remarcarOpen && !!remarcarTarget?.paciente_id && !!competenciaRemarcar,
  });

  const { data: agendamentosRemarcar = [] } = useQuery({
    queryKey: [
      "agendamentos-plano-mes",
      remarcarTarget?.paciente_id,
      competenciaRemarcar?.mes,
      competenciaRemarcar?.ano,
    ],
    queryFn: () =>
      fetchAgendamentosAtivosPacienteMes(
        remarcarTarget!.paciente_id!,
        competenciaRemarcar!.mes,
        competenciaRemarcar!.ano,
      ),
    enabled: remarcarOpen && !!remarcarTarget?.paciente_id && !!competenciaRemarcar,
  });

  const impactoRemarcar = useMemo(() => {
    if (!remarcarTarget || !remarcarPreview || !planoRemarcar) return null;
    return simularRemarcacaoImpacto({
      plano: {
        mes: planoRemarcar.mes,
        ano: planoRemarcar.ano,
        frequenciaLabel: planoRemarcar.frequenciaLabel,
        diasSemanaLabel: planoRemarcar.diasSemanaLabel,
        qtdSessoesCobranca: planoRemarcar.quantidadeMensal,
      },
      agendamentos: agendamentosRemarcar,
      origem: {
        id: remarcarTarget.id,
        inicio: remarcarTarget.inicio,
        status: remarcarTarget.status,
        serie_id: remarcarTarget.serie_id,
      },
      novoInicio: remarcarPreview.novoInicio,
      escopo: remarcarEscopoWatch,
    });
  }, [
    remarcarTarget,
    remarcarPreview,
    planoRemarcar,
    agendamentosRemarcar,
    remarcarEscopoWatch,
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: "",
      fisioId: "",
      data: formatDateDDMMYY(today),
      horaInicio: "08:00",
      duracao: 50,
      servico: "Fisioterapia neurológica",
      statusSlot: "agendado",
      agendarSerieMesmoDia: false,
    },
  });

  const statusSlotWatch = form.watch("statusSlot");
  const pacienteIdWatch = form.watch("pacienteId");
  const dataWatch = form.watch("data");
  const agendarSerieWatch = form.watch("agendarSerieMesmoDia");
  const isMarcacaoSlot = STATUS_SLOT.includes(statusSlotWatch as StatusAgendamento);

  const competenciaNovoAg = useMemo(() => {
    const iso = parseDDMMYYToISO(dataWatch);
    if (!iso) return null;
    const d = new Date(`${iso}T12:00:00`);
    return { mes: d.getMonth() + 1, ano: d.getFullYear() };
  }, [dataWatch]);

  const { data: planoNovoAg } = useQuery({
    queryKey: queryKeys.sessoes.planoMensal(
      pacienteIdWatch,
      competenciaNovoAg?.mes ?? 0,
      competenciaNovoAg?.ano ?? 0,
    ),
    queryFn: () =>
      fetchPlanoSessoesMensalPaciente(
        pacienteIdWatch,
        competenciaNovoAg!.mes,
        competenciaNovoAg!.ano,
      ),
    enabled: modalOpen && !isMarcacaoSlot && !!pacienteIdWatch && !!competenciaNovoAg,
  });

  const horaInicioWatch = form.watch("horaInicio");
  const duracaoWatch = form.watch("duracao");

  const propostasSeriePlano = useMemo(() => {
    if (!planoNovoAg || planoNovoAg.faltantes <= 0) return [];
    const iso = parseDDMMYYToISO(dataWatch);
    if (!iso) return [];

    const slots = gerarSlotsFaltantesPlano({
      mes: planoNovoAg.mes,
      ano: planoNovoAg.ano,
      quantidadeMensal: planoNovoAg.quantidadeMensal ?? planoNovoAg.agendadasNoPlano + planoNovoAg.faltantes,
      diasSemana: planoNovoAg.diasSemanaLabel,
      frequenciaAtendimento: planoNovoAg.frequenciaLabel,
      agendamentosExistentes: planoNovoAg.agendamentosInicioMes.map((inicio) => ({ inicio })),
      dataAncoraIso: iso,
    });

    return montarPropostasAgendamento({
      slots,
      horaBase: horaInicioWatch || "08:00",
      duracaoMin: duracaoWatch || 50,
    });
  }, [planoNovoAg, dataWatch, horaInicioWatch, duracaoWatch]);

  const podeAgendarSerie = !isMarcacaoSlot && propostasSeriePlano.length > 1;

  const invalidateAgenda = () => {
    qc.invalidateQueries({ queryKey: queryKeys.agendamentos.all });
  };

  const createMutation = useMutation({
    mutationFn: async (vals: FormValues) => {
      const isoDate = parseDDMMYYToISO(vals.data);
      if (!isoDate) throw new Error("Data inválida — use dd/mm/aa");
      const isSlot = STATUS_SLOT.includes(vals.statusSlot);

      if (isSlot) {
        await createAgendamento({
          paciente_id: null,
          fisioterapeuta_id: vals.fisioId,
          inicio: `${isoDate}T${vals.horaInicio}:00-03:00`,
          duracao_min: vals.duracao,
          servico: null,
          status: vals.statusSlot,
        });
        return { criados: 1 };
      }

      const usarSerie =
        vals.agendarSerieMesmoDia &&
        !!vals.pacienteId &&
        planoNovoAg &&
        propostasSeriePlano.length > 0;

      if (usarSerie) {
        const serieId = propostasSeriePlano.length > 1 ? crypto.randomUUID() : null;
        const criados = await createAgendamentosLote(
          propostasSeriePlano.map((p) => ({
            paciente_id: vals.pacienteId || null,
            fisioterapeuta_id: vals.fisioId,
            inicio: `${p.dataIso}T${p.horaInicio}:00-03:00`,
            duracao_min: vals.duracao,
            servico: vals.servico || null,
            status: vals.statusSlot,
            serie_id: serieId,
          })),
        );
        return { criados };
      }

      const criados = await createAgendamentosLote([
        {
          paciente_id: vals.pacienteId || null,
          fisioterapeuta_id: vals.fisioId,
          inicio: `${isoDate}T${vals.horaInicio}:00-03:00`,
          duracao_min: vals.duracao,
          servico: vals.servico || null,
          status: vals.statusSlot,
        },
      ]);
      return { criados };
    },
    onSuccess: (result, vals) => {
      invalidateAgenda();
      if (vals.pacienteId && competenciaNovoAg) {
        qc.invalidateQueries({
          queryKey: queryKeys.sessoes.planoMensal(
            vals.pacienteId,
            competenciaNovoAg.mes,
            competenciaNovoAg.ano,
          ),
        });
      }
      toast.success(
        STATUS_SLOT.includes(vals.statusSlot)
          ? "Slot atualizado"
          : result.criados > 1
            ? `${result.criados} agendamentos criados`
            : "Agendamento criado",
      );
      form.reset({
        pacienteId: "",
        fisioId: "",
        data: formatDateDDMMYY(today),
        horaInicio: "08:00",
        duracao: 50,
        servico: "Fisioterapia neurológica",
        statusSlot: "agendado",
        agendarSerieMesmoDia: false,
      });
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, anterior }: { id: string; status: StatusAgendamento; anterior: StatusAgendamento }) =>
      updateStatus(id, status, user?.id ?? null, anterior),
    onSuccess: (_data, vars) => {
      invalidateAgenda();
      qc.invalidateQueries({ queryKey: ["agendamento-historico"] });
      qc.invalidateQueries({ queryKey: queryKeys.sessoes.all });
      qc.invalidateQueries({ queryKey: ["prontuario"] });
      if (selectedAgend?.paciente_id && competenciaAgend) {
        qc.invalidateQueries({
          queryKey: queryKeys.sessoes.planoMensal(
            selectedAgend.paciente_id,
            competenciaAgend.mes,
            competenciaAgend.ano,
          ),
        });
      }
      if (vars.status === "cancelado") {
        toast.success("Agendamento cancelado — horário liberado");
        setConfirmCancelOpen(false);
        setSelectedAgend(null);
        return;
      }
      toast.success("Status atualizado");
      setSelectedAgend((prev) => (prev && prev.id === vars.id ? { ...prev, status: vars.status } : prev));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function pedirCancelamento() {
    if (!selectedAgend) return;
    setConfirmCancelOpen(true);
  }

  function confirmarCancelamento() {
    if (!selectedAgend) return;
    statusMutation.mutate({
      id: selectedAgend.id,
      status: "cancelado",
      anterior: selectedAgend.status,
    });
  }

  const remarcarMutation = useMutation({
    mutationFn: (vals: RemarcarFormValues & { agendamentoId: string }) => {
      const isoDate = parseDDMMYYToISO(vals.data);
      if (!isoDate) throw new Error("Data inválida — use dd/mm/aa");
      if (!/^\d{2}:\d{2}$/.test(vals.horaInicio)) throw new Error("Hora inválida — use HH:mm");
      return remarcarAgendamento({
        agendamentoId: vals.agendamentoId,
        novoInicio: `${isoDate}T${vals.horaInicio}:00-03:00`,
        novoFisioId: vals.fisioId || undefined,
        duracaoMin: vals.duracao,
        escopo: vals.escopo,
        usuarioId: user?.id ?? null,
      });
    },
    onSuccess: async (result) => {
      invalidateAgenda();
      qc.invalidateQueries({ queryKey: ["agendamento-historico"] });
      qc.invalidateQueries({ queryKey: queryKeys.sessoes.all });
      if (remarcarTarget?.paciente_id) {
        const d = new Date(remarcarTarget.inicio);
        qc.invalidateQueries({
          queryKey: queryKeys.sessoes.planoMensal(
            remarcarTarget.paciente_id,
            d.getMonth() + 1,
            d.getFullYear(),
          ),
        });
      }
      if (result.count > 1) {
        toast.success(`${result.count} horários remarcados`);
      } else {
        toast.success("Agendamento remarcado");
      }
      if (result.frequenciaPerdidaCount > 0) {
        toast.warning(
          result.frequenciaPerdidaCount === 1
            ? "A frequência de 1 dia foi removida — o novo dia já tinha outra marcação na planilha."
            : `A frequência de ${result.frequenciaPerdidaCount} dias foi removida — os dias destino já tinham marcação na planilha.`,
        );
      }
      setRemarcarOpen(false);
      setRemarcarTarget(null);

      if (result.primeiroNovoId) {
        const { data, error } = await supabase
          .from("agendamentos")
          .select("*, pacientes(nome, tipo), fisioterapeutas(nome)")
          .eq("id", result.primeiroNovoId)
          .single();
        if (!error && data) {
          const ag = data as unknown as Agendamento;
          setSelectedAgend(ag);
          if (visao === "semana" || visao === "dia") {
            navegarParaDataAgenda(ag.inicio, setSemanaBase, setDiaSemanaIdx);
          }
          if (visao === "mes") setVisao("semana");
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () =>
      agendamentos
        .filter((a) => a.status !== "remarcacao" && a.status !== "cancelado")
        .filter((a) => {
        if (filterFisio !== FILTRO_TODOS && a.fisioterapeuta_id !== filterFisio) return false;
        if (filterTipo !== FILTRO_TODOS && a.pacientes?.tipo !== filterTipo) return false;
        const q = buscaGrade.trim().toLowerCase();
        if (q) {
          const nomeP = a.pacientes?.nome?.toLowerCase() ?? "";
          const nomeF = a.fisioterapeutas?.nome?.toLowerCase() ?? "";
          if (!nomeP.includes(q) && !nomeF.includes(q)) return false;
        }
        return true;
      }),
    [agendamentos, filterFisio, filterTipo, buscaGrade],
  );

  function abrirRemarcar(ag: Agendamento) {
    remarcarForm.reset({
      data: isoToDDMMYY(ag.inicio),
      horaInicio: isoToHHMM(ag.inicio),
      fisioId: ag.fisioterapeuta_id ?? "",
      duracao: ag.duracao_min,
      escopo: "pontual",
    });
    setRemarcarTarget(ag);
    setRemarcarOpen(true);
  }

  function labelHistorico(item: HistoricoRow) {
    const siglaAnterior = parseSiglaHistorico(item.status_anterior);
    const siglaNova = parseSiglaHistorico(item.status_novo);
    if (siglaAnterior || siglaNova) {
      const de = siglaAnterior ? `${siglaAnterior} (${SIGLA_HINT[siglaAnterior]})` : "—";
      const para = siglaNova ? `${siglaNova} (${SIGLA_HINT[siglaNova]})` : "—";
      return `Frequência: ${de} → ${para}`;
    }
    if (item.acao === "remanejamento") {
      const de = item.inicio_anterior ? formatDateTimeDDMMYY(item.inicio_anterior) : "—";
      const para = item.inicio_novo ? formatDateTimeDDMMYY(item.inicio_novo) : "—";
      return `Remanejamento (${item.escopo ?? "pontual"}): ${de} → ${para}`;
    }
    return `Status: ${item.status_anterior ?? "—"} → ${item.status_novo ?? "—"}`;
  }

  const weekDays = DIAS_SEMANA.map((offset) => addDays(semanaBase, offset - 1));
  const diaSelecionado = weekDays[diaSemanaIdx] ?? weekDays[0];
  const dataSelecionada = toDateStr(diaSelecionado);

  const { data: avisoSalvo = "" } = useQuery({
    queryKey: queryKeys.agendamentos.avisoDia(dataSelecionada),
    queryFn: () => fetchAgendaAviso(dataSelecionada),
    enabled: visao === "semana",
  });

  const { data: indisponibilidades = [] } = useQuery({
    queryKey: queryKeys.fisioHorarios.indisponibilidade(
      periodo.inicio,
      periodo.fim,
      filterFisio !== FILTRO_TODOS ? filterFisio : undefined,
    ),
    queryFn: () =>
      fetchFisioIndisponibilidade({
        inicio: periodo.inicio,
        fim: periodo.fim,
        fisioterapeutaId: filterFisio !== FILTRO_TODOS ? filterFisio : undefined,
      }),
    enabled: visao === "semana" || visao === "dia",
  });

  const { data: disponibilidade = [] } = useQuery({
    queryKey: queryKeys.fisioHorarios.disponibilidade(
      filterFisio !== FILTRO_TODOS ? filterFisio : undefined,
    ),
    queryFn: () =>
      fetchFisioDisponibilidade(filterFisio !== FILTRO_TODOS ? filterFisio : undefined),
    enabled: visao === "semana",
  });

  useEffect(() => {
    setAvisoDraft(avisoSalvo);
  }, [avisoSalvo, dataSelecionada]);

  const avisoMutation = useMutation({
    mutationFn: () => upsertAgendaAviso(dataSelecionada, avisoDraft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos.avisoDia(dataSelecionada) });
      toast.success("Avisos do dia salvos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fisiosVisiveis = useMemo(() => {
    let list = filterFisio !== FILTRO_TODOS ? fisios.filter((f) => f.id === filterFisio) : fisios;
    const q = buscaGrade.trim().toLowerCase();
    if (q) list = list.filter((f) => f.nome.toLowerCase().includes(q));
    return list;
  }, [fisios, filterFisio, buscaGrade]);

  const fisiosNomes = useMemo(() => fisiosVisiveis.map((f) => f.nome), [fisiosVisiveis]);

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

  function getAgendamentosForDayHour(day: Date, hour: number) {
    const dayStr = toDateStr(day);
    return filtered.filter((a) => {
      const inicio = new Date(a.inicio);
      return toDateStr(inicio) === dayStr && inicio.getHours() === hour;
    });
  }

  function abrirNovoSlot(day: Date, horaInicio: string, fisioId?: string) {
    form.reset({
      pacienteId: "",
      fisioId: fisioId ?? (filterFisio !== FILTRO_TODOS ? filterFisio : ""),
      data: formatDateDDMMYY(day),
      horaInicio,
      duracao: 50,
      servico: "Fisioterapia neurológica",
      statusSlot: "agendado",
      agendarSerieMesmoDia: false,
    });
    setModalOpen(true);
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
    { value: "semana", label: "Semana padrão" },
    { value: "dia", label: "Grade Seg–Sex" },
    { value: "frequencia", label: "Frequência" },
    { value: "mes", label: "Mês" },
  ];

  const headerTitle =
    visao === "mes"
      ? `Agenda · ${MESES[mesRef.getMonth()]}/${mesRef.getFullYear()}`
      : visao === "frequencia"
        ? `Frequência · ${MESES[mesRef.getMonth()].slice(0, 3)}/${mesRef.getFullYear()}`
        : visao === "dia"
          ? `Agenda · Semana de ${semanaBase.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
          : "Agenda · semana padrão";

  function navBack() {
    if (visao === "mes" || visao === "frequencia") {
      setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1));
    } else {
      const nova = addDays(semanaBase, -7);
      setSemanaBase(nova);
      setDiaSemanaIdx(indexDiaNaSemana(nova));
    }
  }

  function navForward() {
    if (visao === "mes" || visao === "frequencia") {
      setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1));
    } else {
      const nova = addDays(semanaBase, 7);
      setSemanaBase(nova);
      setDiaSemanaIdx(indexDiaNaSemana(nova));
    }
  }

  const navLabelPrev = visao === "mes" || visao === "frequencia" ? "Mês ant." : "Semana ant.";
  const navLabelNext = visao === "mes" || visao === "frequencia" ? "Próx. mês" : "Próx. semana";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Operação <span className="opacity-50">›</span>{" "}
            {visao === "frequencia" ? "Frequência" : "Agenda"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{headerTitle}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={navBack}>
            <ChevronLeft className="h-4 w-4" />
            {navLabelPrev}
          </Button>
          <Button variant="outline" size="sm" onClick={navForward}>
            {navLabelNext}
            <ChevronRight className="h-4 w-4" />
          </Button>
          {podeGerir && (
            <Button variant="outline" size="sm" onClick={() => setHorariosOpen(true)}>
              Horários / Indisponibilidade
            </Button>
          )}
          {visao !== "frequencia" && (
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-4 py-3">
        {visao === "semana" && (
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaGrade}
              onChange={(e) => setBuscaGrade(e.target.value)}
              placeholder="Buscar paciente ou fisioterapeuta"
              className="h-9 pl-8"
            />
          </div>
        )}
        <FilterChip prefix="Fisio" value={filterFisio} options={fisioOptions} onChange={setFilterFisio} />
        <FilterChip prefix="Tipo" value={filterTipo} options={tipoOptions} onChange={setFilterTipo} />
        {visao === "semana" && (
          <p className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
            {fisiosVisiveis.length} fisio{fisiosVisiveis.length !== 1 ? "s" : ""} · {BLOCOS_COUNT} blocos ·{" "}
            {INTERVALOS_COUNT} intervalos
          </p>
        )}
        <div className={visao === "semana" ? "" : "ml-auto"}>
          <FilterChip prefix="Visão" value={visao} options={visaoOptions} onChange={(v) => setVisao(v as VisaoAgenda)} />
        </div>
      </div>

      {isLoading && visao !== "frequencia" ? (
        <LoadingState />
      ) : visao === "frequencia" ? (
        <FrequenciaMensalGrid
          mes={mesRef.getMonth() + 1}
          ano={mesRef.getFullYear()}
          filterFisio={filterFisio}
          filterTipo={filterTipo}
          filtroTodos={FILTRO_TODOS}
        />
      ) : visao === "semana" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 border-b border-border">
            {weekDays.map((day, i) => (
              <button
                key={toDateStr(day)}
                type="button"
                onClick={() => setDiaSemanaIdx(i)}
                className={cn(
                  "min-w-[108px] px-3 py-2.5 text-center transition-colors",
                  diaSemanaIdx === i
                    ? "border-b-2 border-cb-cyan-600 text-foreground"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="block text-[11px] font-bold uppercase tracking-wide">
                  {DIAS_SEMANA_LABEL[i]}
                </span>
                <span className="block text-xs font-semibold tabular-nums">
                  {formatDateDDMMYY(day)}
                </span>
              </button>
            ))}
          </div>

          {fisiosVisiveis.length === 0 ? (
            <EmptyState
              title="Nenhum fisioterapeuta ativo"
              description="Cadastre fisioterapeutas em Equipe para montar a grade da agenda."
            />
          ) : (
            <SemanaPadraoGridShell
              fisios={fisiosVisiveis}
              fisioHeaders={fisiosVisiveis.map((f) => fisioColHeader(f.nome, fisiosNomes))}
              day={diaSelecionado}
              diaSemana={diaSemanaIdx + 1}
              disponibilidade={disponibilidade}
              indisponibilidades={indisponibilidades}
              getAgendamentos={(fisioId, blocoInicio, blocoFim) =>
                filtered.filter(
                  (a) =>
                    a.fisioterapeuta_id === fisioId &&
                    toDateStr(new Date(a.inicio)) === dataSelecionada &&
                    agendamentoNoBloco(a.inicio, blocoInicio, blocoFim),
                )
              }
              onSlotClick={(id) => {
                const ag = filtered.find((a) => a.id === id);
                if (ag) setSelectedAgend(ag);
              }}
              onEmptyClick={(fisioId, horaInicio) =>
                abrirNovoSlot(diaSelecionado, horaInicio, fisioId)
              }
              podeGerir={podeGerir}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SlotStatusLegend />
            {fisiosVisiveis.length > 6 && (
              <p className="text-[11px] text-muted-foreground">
                → role pra ver os {fisiosVisiveis.length} fisioterapeutas
              </p>
            )}
          </div>

          <section className="space-y-2">
            {podeGerir && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div>
                  <Label htmlFor="aviso-dia" className="text-sm font-semibold">
                    Avisos do dia
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {DIAS_SEMANA_LABEL[diaSemanaIdx]} {formatDateDDMMYY(diaSelecionado)} — um aviso por linha
                  </p>
                </div>
                <Textarea
                  id="aviso-dia"
                  value={avisoDraft}
                  onChange={(e) => setAvisoDraft(e.target.value)}
                  placeholder={"Ex.: Dani não virá hoje\nHelena não fará às 14h"}
                  rows={3}
                  className="resize-y text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={avisoMutation.isPending || avisoDraft === avisoSalvo}
                    onClick={() => avisoMutation.mutate()}
                  >
                    {avisoMutation.isPending ? "Salvando…" : "Salvar avisos"}
                  </Button>
                </div>
              </div>
            )}

            {(avisoSalvo || (podeGerir && avisoDraft.trim())) && (
              <div className="rounded-lg border border-cb-orange/25 bg-[#FFF7ED] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-cb-orange mb-1.5">
                  Avisos do dia
                </p>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {formatAvisoDisplay(podeGerir ? avisoDraft : avisoSalvo) || "—"}
                </p>
              </div>
            )}
          </section>
        </div>
      ) : visao === "dia" ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div
              className="grid min-w-[720px] gap-px bg-border"
              style={{ gridTemplateColumns: "60px repeat(5, minmax(0, 1fr))" }}
            >
              <div className="bg-cb-cyan-050 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground" />
              {weekDays.map((day, i) => (
                <div
                  key={toDateStr(day)}
                  className="bg-cb-cyan-050 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {DIAS_PT[day.getDay()]} {day.getDate()}
                  <span className="sr-only"> {DIAS_SEMANA_LABEL[i]}</span>
                </div>
              ))}

              {HOURS.map((hour) => (
                <Fragment key={hour}>
                  <div className="bg-muted/50 px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDays.map((day) => {
                    const items = getAgendamentosForDayHour(day, hour);
                    return (
                      <div
                        key={`${toDateStr(day)}-${hour}`}
                        className={cn(
                          "min-h-[60px] space-y-1 bg-card p-1.5",
                          podeGerir && items.length === 0 && "cursor-pointer hover:bg-muted/30",
                        )}
                        onClick={() => {
                          if (!podeGerir || items.length > 0) return;
                          abrirNovoSlot(day, `${String(hour).padStart(2, "0")}:00`);
                        }}
                      >
                        {items.map((a) => (
                          <AgendaSlot
                            key={a.id}
                            ag={a}
                            onClick={() => setSelectedAgend(a)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <TipoLegend />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Mês sem agendamentos"
          description="Crie um novo agendamento para preencher a agenda."
          action={
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          }
        />
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

      {!isLoading && visao !== "semana" && visao !== "dia" && visao !== "frequencia" && filtered.length > 0 && (
        <TipoLegend />
      )}

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAgend?.pacientes?.nome
                ? `O horário de ${selectedAgend.pacientes.nome} será liberado na grade.`
                : "O horário será liberado na grade (slot volta a ficar vago)."}
              {" "}Essa ação fica registrada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmarCancelamento();
              }}
            >
              {statusMutation.isPending ? "Cancelando…" : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FisioHorariosDialog
        open={horariosOpen}
        onOpenChange={setHorariosOpen}
        fisios={fisios}
      />

      <Sheet open={!!selectedAgend} onOpenChange={(o) => { if (!o) setSelectedAgend(null); }}>
        <SheetContent className="flex h-full w-full flex-col overflow-hidden sm:max-w-md">
          {selectedAgend && (
            <>
              <SheetHeader className="shrink-0">
                <SheetTitle>Agendamento</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="mt-4 space-y-3 pb-4 text-sm">
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

                {podeGerir && selectedAgend.paciente_id && ["agendado", "confirmado"].includes(selectedAgend.status) && (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Registro de sessão
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            id: selectedAgend.id,
                            status: "realizado",
                            anterior: selectedAgend.status,
                          })
                        }
                      >
                        Compareceu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            id: selectedAgend.id,
                            status: "faltou",
                            anterior: selectedAgend.status,
                          })
                        }
                      >
                        Não compareceu
                      </Button>
                    </div>
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
                      onClick={pedirCancelamento}
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

                {podeGerir && STATUS_EDITAVEIS.includes(selectedAgend.status) && (
                  <div className="pt-4 space-y-2 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Status do slot
                    </p>
                    <Select
                      value={
                        STATUS_SLOT.includes(selectedAgend.status)
                          ? selectedAgend.status
                          : undefined
                      }
                      onValueChange={(v) => {
                        statusMutation.mutate({
                          id: selectedAgend.id,
                          status: v as StatusAgendamento,
                          anterior: selectedAgend.status,
                        });
                      }}
                      disabled={statusMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar status do slot…" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_SLOT.map((st) => (
                          <SelectItem key={st} value={st}>
                            {STATUS_LABEL[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {STATUS_SLOT.includes(selectedAgend.status) && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({
                              id: selectedAgend.id,
                              status: "agendado",
                              anterior: selectedAgend.status,
                            })
                          }
                        >
                          Voltar p/ agendado
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/5"
                          disabled={statusMutation.isPending}
                          onClick={pedirCancelamento}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {selectedAgend.paciente_id && planoSessoesMensal && (
                  <PacientePlanoSessoesCard
                    resumo={planoSessoesMensal}
                    agendamentoAtualId={selectedAgend.id}
                  />
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
                {remarcarTarget.pacientes?.nome ?? "Paciente"} · horário atual{" "}
                {formatDateTimeDDMMYY(remarcarTarget.inicio)}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="remarcar-data">Nova data</Label>
                  <Controller
                    control={remarcarForm.control}
                    name="data"
                    render={({ field }) => (
                      <DateInputDDMMYY id="remarcar-data" {...field} />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="remarcar-hora">Nova hora</Label>
                  <Controller
                    control={remarcarForm.control}
                    name="horaInicio"
                    render={({ field }) => (
                      <TimeInputHHMM id="remarcar-hora" {...field} />
                    )}
                  />
                </div>
              </div>

              {remarcarPreview && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs space-y-1">
                  <p>
                    <span className="text-muted-foreground">Novo horário: </span>
                    <span className="font-medium">{remarcarPreview.destinoLabel}</span>
                    <span className="text-muted-foreground"> ({formatDeltaDias(remarcarPreview.deltaDias)})</span>
                  </p>
                  {remarcarPreview.cruzaSemana && (
                    <p className="text-cb-orange font-medium">
                      A data cai em outra semana — após confirmar, a agenda abrirá nessa semana.
                    </p>
                  )}
                  {siglaDiaRemarcar && remarcarPreview && remarcarPreview.deltaDias !== 0 && (
                    <p className="text-cb-orange font-medium">
                      {siglaDiaRemarcarDestino
                        ? `Este dia tem frequência (${siglaDiaRemarcar}) — ao remarcar, ela será removida porque o novo dia já tem ${siglaDiaRemarcarDestino}.`
                        : `Este dia tem frequência marcada (${siglaDiaRemarcar}) — ela será movida para o novo dia${remarcarPreview.cruzaSemana ? " (outra semana na planilha)" : ""}.`}
                    </p>
                  )}
                  {remarcarEscopoWatch !== "pontual" && contagensEscopo && (
                    <p className="text-muted-foreground">
                      Escopo &quot;{remarcarEscopoWatch}&quot;:{" "}
                      {remarcarEscopoWatch === "semana"
                        ? contagensEscopo.semana
                        : contagensEscopo.serie_mes}{" "}
                      horário(s) serão deslocados pelo mesmo intervalo.
                    </p>
                  )}
                </div>
              )}

              {impactoRemarcar?.usaSlots && impactoRemarcar.avisos.length > 0 && (
                <div className="rounded-lg border border-cb-orange/40 bg-cb-orange/5 px-3 py-2.5 text-xs space-y-1">
                  <p className="font-medium text-cb-orange">Impacto no plano mensal</p>
                  {impactoRemarcar.avisos.map((aviso) => (
                    <p
                      key={aviso}
                      className={
                        aviso.includes("fora dos dias do plano")
                          ? "text-cb-orange font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {aviso}
                    </p>
                  ))}
                </div>
              )}

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
                    <Label htmlFor="escopo-pontual" className="font-normal">
                      Só este horário
                      {contagensEscopo && (
                        <span className="ml-1 text-muted-foreground">({contagensEscopo.pontual} horário)</span>
                      )}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="semana" id="escopo-semana" />
                    <Label htmlFor="escopo-semana" className="font-normal">
                      Demais futuros do paciente na mesma semana
                      {contagensEscopo && (
                        <span className="ml-1 text-muted-foreground">
                          ({contagensEscopo.semana} horário{contagensEscopo.semana !== 1 ? "s" : ""})
                        </span>
                      )}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="serie_mes" id="escopo-mes" />
                    <Label htmlFor="escopo-mes" className="font-normal">
                      Demais futuros do paciente até fim do mês
                      {contagensEscopo && (
                        <span className="ml-1 text-muted-foreground">
                          ({contagensEscopo.serie_mes} horário{contagensEscopo.serie_mes !== 1 ? "s" : ""})
                        </span>
                      )}
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
            <DialogTitle>
              {isMarcacaoSlot ? "Marcar status do slot" : "Novo agendamento"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="statusSlot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status do slot</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="agendado">Agendamento (paciente)</SelectItem>
                        {STATUS_SLOT.map((st) => (
                          <SelectItem key={st} value={st}>
                            {STATUS_LABEL[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isMarcacaoSlot && (
                <FormField control={form.control} name="pacienteId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paciente *</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("agendarSerieMesmoDia", false);
                      }}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger></FormControl>
                      <SelectContent className="max-h-60">
                        {pacientes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {planoNovoAg && field.value && (
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
                        <p className="font-medium text-foreground">
                          Plano do mês: {planoNovoAg.quantidadeExibicao}
                          {planoNovoAg.frequenciaLabel ? ` · ${planoNovoAg.frequenciaLabel}` : ""}
                        </p>
                        {planoNovoAg.diasSemanaLabel && (
                          <p className="text-muted-foreground">{planoNovoAg.diasSemanaLabel}</p>
                        )}
                        <p className="text-muted-foreground">
                          {planoNovoAg.agendadasNoPlano} no plano
                          {planoNovoAg.faltantes > 0
                            ? ` · ${planoNovoAg.faltantes} faltante${planoNovoAg.faltantes === 1 ? "" : "s"}`
                            : " · plano completo"}
                        </p>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {!isMarcacaoSlot && podeAgendarSerie && (
                <FormField
                  control={form.control}
                  name="agendarSerieMesmoDia"
                  render={({ field }) => (
                    <FormItem className="rounded-md border border-dashed px-3 py-3">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(v) => field.onChange(v === true)}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-medium cursor-pointer">
                            Agendar {propostasSeriePlano.length} sessões faltantes do plano neste mês
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {planoNovoAg.diasSemanaLabel
                              ? `Padrão: ${planoNovoAg.diasSemanaLabel}`
                              : "Padrão: mesmo dia da semana da data escolhida"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {propostasSeriePlano.slice(0, 4).map((p) => `${formatDateDDMMYY(p.dataIso)} ${p.horaInicio}`).join(" · ")}
                            {propostasSeriePlano.length > 4
                              ? ` · +${propostasSeriePlano.length - 4} horários`
                              : ""}
                          </p>
                          {!planoNovoAg.diasSemanaLabel && (
                            <p className="text-xs text-cb-orange font-medium">
                              Cadastre os dias da semana no paciente para montar o plano completo (ex.: 2ª e 5ª triplos).
                            </p>
                          )}
                        </div>
                      </div>
                    </FormItem>
                  )}
                />
              )}

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
                    <FormControl>
                      <DateInputDDMMYY {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="horaInicio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora início *</FormLabel>
                    <FormControl>
                      <TimeInputHHMM {...field} />
                    </FormControl>
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

              {!isMarcacaoSlot && (
                <FormField control={form.control} name="servico" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de sessão</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Ex: Fisioterapia neurológica" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending
                    ? "Salvando…"
                    : isMarcacaoSlot
                      ? "Marcar slot"
                      : agendarSerieWatch && propostasSeriePlano.length > 1
                        ? `Criar ${propostasSeriePlano.length} agendamentos`
                        : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
