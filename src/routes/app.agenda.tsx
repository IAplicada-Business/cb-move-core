import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  CheckCircle2,
  Plus,
  Search,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { AgendaDayStrip, AgendaWeekGrid } from "@/components/domain/agenda";
import { DateInputDDMMYY } from "@/components/domain/DateInputDDMMYY";
import { TimeInputHHMM } from "@/components/domain/TimeInputHHMM";
import { EmptyState } from "@/components/domain/EmptyState";
import {
  ACCENT_HEADER_BG,
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  DashboardSectionHeader,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { KpiCard } from "@/components/domain/KpiCard";
import { StatusDistributionBar } from "@/components/domain/MetricVisuals";
import { PageHeader } from "@/components/brand/PageHeader";
import { DataToolbar, DataToolbarSearch } from "@/components/brand/DataToolbar";
import { FilterChip } from "@/components/domain/FilterChip";
import { FisioHorariosDialog } from "@/components/domain/FisioHorariosDialog";
import { PacientePlanoSessoesCard } from "@/components/domain/PacientePlanoSessoesCard";
import { RemarcarAgendamentoSection } from "@/components/domain/RemarcarAgendamentoSection";
import { RemarcarDialog } from "@/components/domain/RemarcarDialog";
import { SessaoMultiFisioEditor } from "@/components/domain/SessaoMultiFisioEditor";
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
  fetchAgendamentoPorId,
  fetchAgendamentosPeriodo,
  resolverSerieIdPacienteMes,
  updateAgendamentoStatus,
  fetchAgendaAviso,
  type HistoricoRow,
  upsertAgendaAviso,
} from "@/lib/queries/agenda";
import {
  fetchFisioDisponibilidade,
  fetchFisioIndisponibilidade,
} from "@/lib/queries/fisio-horarios";
import { fetchPlanoSessoesMensalPaciente } from "@/lib/queries/plano-sessoes";
import type { ItemSessaoMensal } from "@/lib/domain/plano-sessoes-mensal";
import type { SlotRemarcacaoSelecionado } from "@/lib/domain/remarcacao-disponibilidade";
import type { SlotPlanoMensal } from "@/lib/domain/padrao-agenda-mensal";
import {
  gerarSlotsFaltantesPlano,
  montarPropostasAgendamento,
} from "@/lib/domain/padrao-agenda-mensal";
import { useAuth } from "@/lib/auth";
import { can, isFisioScopedUser } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { parseSiglaHistorico, SIGLA_HINT } from "@/lib/domain/frequencia";
import type { PacienteTipo, StatusAgendamento } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  blocoDuracaoDefault,
  duracaoSessaoLabel,
  horarioSessaoLabel,
  SESSAO_DURACAO_MIN,
  sessaoDuracaoOpcoes,
} from "@/lib/domain/slot-status";
import {
  formatDateDDMMYY,
  formatDateTimeDDMMYY,
  isoToDDMMYY,
  parseDDMMYYToISO,
} from "@/lib/format";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda · CB MOVE" }] }),
  component: AgendaPage,
});

// ─── constants ───────────────────────────────────────────────────────────────

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const DIAS_SEMANA = [1, 2, 3, 4, 5];
const HOURS: number[] = [];
for (let h = 8; h <= 20; h++) HOURS.push(h);
const FILTRO_TODOS = "todos";
const MESES = [
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

type VisaoAgenda = "semana" | "dia" | "frequencia" | "mes";

const TIPO_SLOT: Record<PacienteTipo, string> = {
  particular: "bg-cb-cyan-600/12 text-cb-cyan-800 ring-1 ring-cb-cyan-600/25",
  judicial: "bg-cb-magenta/12 text-cb-magenta ring-1 ring-cb-magenta/25",
  convenio: "bg-cb-purple/12 text-cb-purple ring-1 ring-cb-purple/25",
  puc: "bg-cb-orange/12 text-cb-orange ring-1 ring-cb-orange/25",
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

async function fetchAgendamentosPeriodoLocal(inicio: string, fim: string): Promise<Agendamento[]> {
  const rows = await fetchAgendamentosPeriodo(inicio, fim);
  return rows as unknown as Agendamento[];
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
    "w-full rounded-xl px-2.5 py-1.5 text-left text-[11.5px] leading-tight shadow-sm",
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
        {fisio} · {duracaoSessaoLabel(ag.duracao_min)}
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
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

// ─── page ────────────────────────────────────────────────────────────────────

function AgendaPage() {
  const qc = useQueryClient();
  const { user, roles, fisioterapeutaId } = useAuth();
  const podeGerir = can.manageAgenda(roles, fisioterapeutaId);
  const isFisioScoped = isFisioScopedUser(roles, fisioterapeutaId);
  const fisioScopeId = isFisioScoped ? (fisioterapeutaId ?? null) : null;
  const today = new Date();
  const [semanaBase, setSemanaBase] = useState(() => startOfWeek(today));
  const [diaSemanaIdx, setDiaSemanaIdx] = useState(() => indexDiaNaSemana(startOfWeek(today)));
  const [mesRef, setMesRef] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [visao, setVisao] = useState<VisaoAgenda>("semana");
  const [filterFisio, setFilterFisio] = useState(FILTRO_TODOS);
  const [filterTipo, setFilterTipo] = useState(FILTRO_TODOS);
  const fisioFilterAtivo = fisioScopeId ?? (filterFisio !== FILTRO_TODOS ? filterFisio : undefined);
  const [buscaGrade, setBuscaGrade] = useState("");
  const [selectedAgend, setSelectedAgend] = useState<Agendamento | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);
  const [remarcarOpen, setRemarcarOpen] = useState(false);
  const [remarcarTarget, setRemarcarTarget] = useState<Agendamento | null>(null);
  const [remarcarPrefill, setRemarcarPrefill] = useState<SlotRemarcacaoSelecionado | null>(null);
  const [avisoDraft, setAvisoDraft] = useState("");

  useEffect(() => {
    if (fisioScopeId) setFilterFisio(fisioScopeId);
  }, [fisioScopeId]);

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
    queryFn: () => fetchAgendamentosPeriodoLocal(periodo.inicio, periodo.fim),
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

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pacienteId: "",
      fisioId: "",
      data: formatDateDDMMYY(today),
      horaInicio: "08:00",
      duracao: blocoDuracaoDefault("08:00"),
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

  const pacienteIdForm = pacienteIdWatch ?? "";

  const { data: planoNovoAg } = useQuery({
    queryKey: queryKeys.sessoes.planoMensal(
      pacienteIdForm,
      competenciaNovoAg?.mes ?? 0,
      competenciaNovoAg?.ano ?? 0,
    ),
    queryFn: () =>
      fetchPlanoSessoesMensalPaciente(
        pacienteIdForm,
        competenciaNovoAg!.mes,
        competenciaNovoAg!.ano,
      ),
    enabled: modalOpen && !isMarcacaoSlot && !!pacienteIdForm && !!competenciaNovoAg,
  });

  const horaInicioWatch = form.watch("horaInicio");
  const duracaoWatch = form.watch("duracao");

  useEffect(() => {
    if (!modalOpen || isMarcacaoSlot) return;
    if (!/^\d{2}:\d{2}$/.test(horaInicioWatch)) return;
    form.setValue("duracao", blocoDuracaoDefault(horaInicioWatch), { shouldValidate: true });
  }, [horaInicioWatch, modalOpen, isMarcacaoSlot, form]);

  const propostasSeriePlano = useMemo(() => {
    if (!planoNovoAg || planoNovoAg.faltantes <= 0) return [];
    const iso = parseDDMMYYToISO(dataWatch);
    if (!iso) return [];

    const slots = gerarSlotsFaltantesPlano({
      mes: planoNovoAg.mes,
      ano: planoNovoAg.ano,
      quantidadeMensal:
        planoNovoAg.quantidadeMensal ?? planoNovoAg.agendadasNoPlano + planoNovoAg.faltantes,
      diasSemana: planoNovoAg.diasSemanaLabel,
      frequenciaAtendimento: planoNovoAg.frequenciaLabel,
      agendamentosExistentes: planoNovoAg.agendamentosInicioMes.map((inicio) => ({ inicio })),
      dataAncoraIso: iso,
    });

    return montarPropostasAgendamento({
      slots,
      horaBase: horaInicioWatch || "08:00",
      duracaoMin: duracaoWatch || SESSAO_DURACAO_MIN,
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
        const serieId = await resolverSerieIdPacienteMes(
          vals.pacienteId,
          competenciaNovoAg!.mes,
          competenciaNovoAg!.ano,
        );
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

      let serieId: string | null = null;
      if (vals.pacienteId && competenciaNovoAg) {
        serieId = await resolverSerieIdPacienteMes(
          vals.pacienteId,
          competenciaNovoAg.mes,
          competenciaNovoAg.ano,
        );
      }

      const criados = await createAgendamentosLote([
        {
          paciente_id: vals.pacienteId || null,
          fisioterapeuta_id: vals.fisioId,
          inicio: `${isoDate}T${vals.horaInicio}:00-03:00`,
          duracao_min: vals.duracao,
          servico: vals.servico || null,
          status: vals.statusSlot,
          serie_id: serieId,
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
        duracao: blocoDuracaoDefault("08:00"),
        servico: "Fisioterapia neurológica",
        statusSlot: "agendado",
        agendarSerieMesmoDia: false,
      });
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      anterior,
    }: {
      id: string;
      status: StatusAgendamento;
      anterior: StatusAgendamento;
    }) => updateStatus(id, status, user?.id ?? null, anterior),
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
      setSelectedAgend((prev) =>
        prev && prev.id === vars.id ? { ...prev, status: vars.status } : prev,
      );
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

  function abrirRemarcar(ag: Agendamento, prefill?: SlotRemarcacaoSelecionado) {
    setRemarcarTarget(ag);
    setRemarcarPrefill(prefill ?? null);
    setRemarcarOpen(true);
  }

  async function abrirSessaoDoPlano(item: ItemSessaoMensal) {
    try {
      const ag = await fetchAgendamentoPorId(item.id);
      setSelectedAgend(ag as unknown as Agendamento);
      if (visao === "semana" || visao === "dia") {
        navegarParaDataAgenda(ag.inicio, setSemanaBase, setDiaSemanaIdx);
      }
      if (visao === "mes") setVisao("semana");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir a sessão");
    }
  }

  function abrirFaltanteDoPlano(slot: SlotPlanoMensal) {
    if (!selectedAgend?.paciente_id || !slot.dataIso) return;
    const [y, m, d] = slot.dataIso.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    const hora =
      selectedAgend.inicio.length >= 16
        ? `${selectedAgend.inicio.slice(11, 13)}:${selectedAgend.inicio.slice(14, 16)}`
        : "08:00";
    abrirNovoSlot(day, hora, selectedAgend.fisioterapeuta_id ?? undefined);
    form.setValue("pacienteId", selectedAgend.paciente_id);
    form.setValue("agendarSerieMesmoDia", true);
  }

  const filtered = useMemo(
    () =>
      agendamentos
        .filter((a) => a.status !== "remarcacao" && a.status !== "cancelado")
        .filter((a) => {
          if (fisioScopeId && a.fisioterapeuta_id !== fisioScopeId) return false;
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
    [agendamentos, filterFisio, filterTipo, buscaGrade, fisioScopeId],
  );

  const agendaStats = useMemo(() => {
    const paraStats = filtered.filter((a) => !STATUS_SLOT.includes(a.status));
    return {
      total: paraStats.length,
      confirmados: paraStats.filter((a) => a.status === "confirmado").length,
      realizados: paraStats.filter((a) => a.status === "realizado").length,
      faltos: paraStats.filter((a) => a.status === "faltou").length,
      cancelados: paraStats.filter((a) => a.status === "cancelado").length,
      agendados: paraStats.filter((a) => a.status === "agendado").length,
    };
  }, [filtered]);

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
      fisioFilterAtivo,
    ),
    queryFn: () =>
      fetchFisioIndisponibilidade({
        inicio: periodo.inicio,
        fim: periodo.fim,
        fisioterapeutaId: fisioFilterAtivo,
      }),
    enabled: visao === "semana" || visao === "dia",
  });

  const { data: disponibilidade = [] } = useQuery({
    queryKey: queryKeys.fisioHorarios.disponibilidade(fisioFilterAtivo),
    queryFn: () => fetchFisioDisponibilidade(fisioFilterAtivo),
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
    let list = fisioScopeId
      ? fisios.filter((f) => f.id === fisioScopeId)
      : filterFisio !== FILTRO_TODOS
        ? fisios.filter((f) => f.id === filterFisio)
        : fisios;
    const q = buscaGrade.trim().toLowerCase();
    if (q) list = list.filter((f) => f.nome.toLowerCase().includes(q));
    return list;
  }, [fisios, filterFisio, buscaGrade, fisioScopeId]);

  const fisiosNomes = useMemo(() => fisiosVisiveis.map((f) => f.nome), [fisiosVisiveis]);

  const monthWeeks = useMemo(() => weeksInMonth(mesRef.getFullYear(), mesRef.getMonth()), [mesRef]);

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
      duracao: blocoDuracaoDefault(horaInicio),
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
    <DashboardPage>
      <PageHeader
        crumbs={[
          { label: "Operação" },
          { label: visao === "frequencia" ? "Frequência" : "Agenda" },
        ]}
        title={headerTitle}
        description={
          visao === "frequencia"
            ? "Controle de frequência mensal por paciente"
            : "Planejamento semanal, grade diária e visão mensal"
        }
        actions={
          <>
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
                Horários
              </Button>
            )}
            {podeGerir && visao !== "frequencia" && (
              <Button
                onClick={() => setModalOpen(true)}
                className="gap-2 bg-cb-cyan-600 hover:bg-cb-cyan-700"
              >
                <Plus className="h-4 w-4" /> Novo agendamento
              </Button>
            )}
          </>
        }
      />

      {visao !== "frequencia" && (
        <>
          <KpiGrid columns={4}>
            <KpiCard
              label="No período"
              value={agendaStats.total}
              accent="cyan"
              icon={<CalendarClock className="h-5 w-5" />}
            />
            <KpiCard
              label="Confirmados"
              value={agendaStats.confirmados}
              accent="lime"
              icon={<CheckCircle2 className="h-5 w-5" />}
              share={
                agendaStats.total > 0 ? (agendaStats.confirmados / agendaStats.total) * 100 : 0
              }
            />
            <KpiCard
              label="Realizados"
              value={agendaStats.realizados}
              accent="purple"
              icon={<CheckCircle2 className="h-5 w-5" />}
              share={agendaStats.total > 0 ? (agendaStats.realizados / agendaStats.total) * 100 : 0}
            />
            <KpiCard
              label="Faltos"
              value={agendaStats.faltos}
              accent="orange"
              icon={<UserX className="h-5 w-5" />}
              share={agendaStats.total > 0 ? (agendaStats.faltos / agendaStats.total) * 100 : 0}
            />
          </KpiGrid>

          {agendaStats.total > 0 && (
            <StatusDistributionBar
              totalLabel="Status no período"
              formatValue={(n) => String(n)}
              segments={[
                { label: "Agendado", value: agendaStats.agendados, colorClass: "bg-cb-orange" },
                { label: "Confirmado", value: agendaStats.confirmados, colorClass: "bg-cb-lime" },
                { label: "Realizado", value: agendaStats.realizados, colorClass: "bg-cb-purple" },
                { label: "Faltou", value: agendaStats.faltos, colorClass: "bg-cb-magenta" },
                {
                  label: "Cancelado",
                  value: agendaStats.cancelados,
                  colorClass: "bg-muted-foreground/40",
                },
              ]}
            />
          )}
        </>
      )}

      <DataToolbar>
        {visao === "semana" && (
          <DataToolbarSearch>
            <Search className="h-4 w-4 shrink-0 text-cb-muted" />
            <Input
              value={buscaGrade}
              onChange={(e) => setBuscaGrade(e.target.value)}
              placeholder="Buscar paciente ou fisioterapeuta"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </DataToolbarSearch>
        )}
        {!isFisioScoped && (
          <FilterChip
            prefix="Fisio"
            value={filterFisio}
            options={fisioOptions}
            onChange={setFilterFisio}
          />
        )}
        <FilterChip
          prefix="Tipo"
          value={filterTipo}
          options={tipoOptions}
          onChange={setFilterTipo}
        />
        {visao === "semana" && (
          <p className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
            {fisiosVisiveis.length} fisio{fisiosVisiveis.length !== 1 ? "s" : ""} · {BLOCOS_COUNT}{" "}
            blocos · {INTERVALOS_COUNT} intervalos · sessão {duracaoSessaoLabel(SESSAO_DURACAO_MIN)}
          </p>
        )}
        <div className={visao === "semana" ? "" : "ml-auto"}>
          <FilterChip
            prefix="Visão"
            value={visao}
            options={visaoOptions}
            onChange={(v) => setVisao(v as VisaoAgenda)}
          />
        </div>
      </DataToolbar>

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
        <DashboardSection
          eyebrow="Grade"
          accent="cyan"
          title="Semana padrão"
          badge={
            <DashboardSectionBadge accent="cyan">
              {DIAS_SEMANA_LABEL[diaSemanaIdx]} · {formatDateDDMMYY(diaSelecionado)}
            </DashboardSectionBadge>
          }
          noPadding
          bodyClassName="space-y-4 p-4"
        >
          <div className="space-y-4">
            <AgendaDayStrip
              days={weekDays}
              labels={DIAS_SEMANA_LABEL}
              selectedIdx={diaSemanaIdx}
              onSelect={setDiaSemanaIdx}
            />

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
          </div>

          <section className="space-y-3">
            {podeGerir && (
              <div className="overflow-hidden rounded-2xl border border-cb-orange/35 bg-card shadow-sm">
                <DashboardSectionHeader
                  eyebrow="Agenda"
                  accent="orange"
                  title="Avisos do dia"
                  description={`${DIAS_SEMANA_LABEL[diaSemanaIdx]} ${formatDateDDMMYY(diaSelecionado)} — um aviso por linha`}
                />
                <div className="space-y-3 border-t border-cb-orange/15 bg-[#FFFBEB]/40 p-5">
                  <Textarea
                    id="aviso-dia"
                    value={avisoDraft}
                    onChange={(e) => setAvisoDraft(e.target.value)}
                    placeholder={"Ex.: Dani não virá hoje\nHelena não fará às 14h"}
                    rows={3}
                    className="resize-y border-cb-orange/30 bg-background text-sm text-cb-ink placeholder:text-cb-muted focus-visible:ring-cb-orange/40"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-cb-orange text-white hover:bg-cb-orange/90 disabled:opacity-50"
                      disabled={avisoMutation.isPending || avisoDraft === avisoSalvo}
                      onClick={() => avisoMutation.mutate()}
                    >
                      {avisoMutation.isPending ? "Salvando…" : "Salvar avisos"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {(avisoSalvo || (podeGerir && avisoDraft.trim())) && (
              <div className="overflow-hidden rounded-2xl border border-cb-orange/40 shadow-sm">
                <div
                  className={cn(
                    "border-b border-cb-orange/20 px-5 py-3 dark:border-cb-orange/30",
                    ACCENT_HEADER_BG.orange,
                  )}
                >
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-cb-orange">
                    Publicado
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-cb-ink">Avisos do dia</p>
                </div>
                <p className="px-5 py-4 text-sm leading-relaxed text-cb-ink whitespace-pre-wrap">
                  {formatAvisoDisplay(podeGerir ? avisoDraft : avisoSalvo) || "—"}
                </p>
              </div>
            )}
          </section>
        </DashboardSection>
      ) : visao === "dia" ? (
        <DashboardSection
          eyebrow="Horários"
          accent="lime"
          title="Grade Seg–Sex"
          description="Horários por dia — clique em slot vazio para agendar"
          noPadding
          bodyClassName="p-4 space-y-3"
        >
          <AgendaWeekGrid
            weekDays={weekDays}
            dayLabels={DIAS_SEMANA_LABEL}
            hours={HOURS}
            getItems={getAgendamentosForDayHour}
            onSlotClick={setSelectedAgend}
            onEmptyClick={abrirNovoSlot}
            podeGerir={podeGerir}
            toDateStr={toDateStr}
            diasPt={DIAS_PT}
          />
          <TipoLegend />
        </DashboardSection>
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
              <DashboardSection
                key={week.label}
                eyebrow="Semana"
                accent="cyan"
                title={week.label}
                noPadding
                bodyClassName="p-4"
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {week.days.map((day) => {
                    const items = agendamentosNoDia(day);
                    if (items.length === 0) return null;
                    return (
                      <div
                        key={toDateStr(day)}
                        className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
                      >
                        <header
                          className={cn(
                            "border-b border-border/60 px-4 py-3.5",
                            ACCENT_HEADER_BG.cyan,
                          )}
                        >
                          <h3 className="text-sm font-extrabold capitalize text-cb-ink">
                            {day.toLocaleDateString("pt-BR", {
                              weekday: "long",
                              day: "2-digit",
                              month: "short",
                            })}
                          </h3>
                        </header>
                        <ul className="divide-y divide-border">
                          {items.map((a) => (
                            <li
                              key={a.id}
                              className="flex cursor-pointer items-center gap-4 px-4 py-3.5 transition-colors hover:bg-cb-cyan-050/60"
                              onClick={() => setSelectedAgend(a)}
                            >
                              <div className="grid min-h-[52px] min-w-[52px] shrink-0 place-items-center rounded-2xl bg-cb-cyan-050 px-1 py-1.5 text-center ring-1 ring-cb-cyan-100">
                                <span className="block text-[10px] font-bold tabular-nums text-cb-cyan-800">
                                  {formatHHMM(new Date(a.inicio))}
                                </span>
                                <span className="block text-[9px] font-medium text-cb-muted">
                                  {duracaoSessaoLabel(a.duracao_min)}
                                </span>
                              </div>
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
                </div>
              </DashboardSection>
            );
          })}
        </div>
      )}

      {!isLoading &&
        visao !== "semana" &&
        visao !== "dia" &&
        visao !== "frequencia" &&
        filtered.length > 0 && <TipoLegend />}

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAgend?.pacientes?.nome
                ? `O horário de ${selectedAgend.pacientes.nome} será liberado na grade.`
                : "O horário será liberado na grade (slot volta a ficar vago)."}{" "}
              Essa ação fica registrada no histórico.
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

      <FisioHorariosDialog open={horariosOpen} onOpenChange={setHorariosOpen} fisios={fisios} />

      <Sheet
        open={!!selectedAgend}
        onOpenChange={(o) => {
          if (!o) setSelectedAgend(null);
        }}
      >
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
                      <div className="mt-1">
                        <TipoBadge value={selectedAgend.pacientes.tipo} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fisioterapeuta</p>
                    <p className="font-medium">{selectedAgend.fisioterapeutas?.nome ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horário</p>
                    <p className="font-medium">
                      {horarioSessaoLabel(selectedAgend.inicio, selectedAgend.duracao_min)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTimeDDMMYY(selectedAgend.inicio)}
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

                  {selectedAgend.paciente_id &&
                    (selectedAgend.status === "realizado" || selectedAgend.status === "faltou") && (
                      <SessaoMultiFisioEditor
                        pacienteId={selectedAgend.paciente_id}
                        dataIso={selectedAgend.inicio.slice(0, 10)}
                        fisioPrincipalId={selectedAgend.fisioterapeuta_id}
                      />
                    )}

                  {podeGerir &&
                    selectedAgend.paciente_id &&
                    ["agendado", "confirmado"].includes(selectedAgend.status) && (
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
                      <RemarcarAgendamentoSection
                        target={selectedAgend}
                        onAbrirRemarcar={(prefill) => abrirRemarcar(selectedAgend, prefill)}
                      />
                    </div>
                  )}

                  {selectedAgend.paciente_id && planoSessoesMensal && (
                    <PacientePlanoSessoesCard
                      resumo={planoSessoesMensal}
                      agendamentoAtualId={selectedAgend.id}
                      onSessaoClick={abrirSessaoDoPlano}
                      onFaltanteClick={abrirFaltanteDoPlano}
                    />
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

                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Histórico
                    </p>
                    {historico.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
                    ) : (
                      <ul className="space-y-2">
                        {historico.map((h) => (
                          <li
                            key={h.id}
                            className="rounded-md border bg-muted/20 px-3 py-2 text-xs"
                          >
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

      <RemarcarDialog
        open={remarcarOpen}
        onOpenChange={(o) => {
          setRemarcarOpen(o);
          if (!o) {
            setRemarcarTarget(null);
            setRemarcarPrefill(null);
          }
        }}
        target={
          remarcarTarget ? { ...remarcarTarget, serie_id: remarcarTarget.serie_id ?? null } : null
        }
        fisios={fisios}
        usuarioId={user?.id ?? null}
        prefillSlot={remarcarPrefill}
        onRemarcado={(ag) => {
          invalidateAgenda();
          setSelectedAgend(ag as unknown as Agendamento);
          setRemarcarTarget(null);
          if (visao === "semana" || visao === "dia") {
            navegarParaDataAgenda(ag.inicio, setSemanaBase, setDiaSemanaIdx);
          }
          if (visao === "mes") setVisao("semana");
        }}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isMarcacaoSlot ? "Marcar status do slot" : "Novo agendamento"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
              className="space-y-4"
            >
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
                <FormField
                  control={form.control}
                  name="pacienteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paciente *</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.setValue("agendarSerieMesmoDia", false);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {pacientes.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
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
                  )}
                />
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
                            Agendar {propostasSeriePlano.length} sessões faltantes do plano neste
                            mês
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {planoNovoAg?.diasSemanaLabel
                              ? `Padrão: ${planoNovoAg.diasSemanaLabel}`
                              : "Padrão: mesmo dia da semana da data escolhida"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {propostasSeriePlano
                              .slice(0, 4)
                              .map((p) => `${formatDateDDMMYY(p.dataIso)} ${p.horaInicio}`)
                              .join(" · ")}
                            {propostasSeriePlano.length > 4
                              ? ` · +${propostasSeriePlano.length - 4} horários`
                              : ""}
                          </p>
                          {!planoNovoAg?.diasSemanaLabel && (
                            <p className="text-xs text-cb-orange font-medium">
                              Cadastre os dias da semana no paciente para montar o plano completo
                              (ex.: 2ª e 5ª triplos).
                            </p>
                          )}
                        </div>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="fisioId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fisioterapeuta *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fisios.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="data"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data *</FormLabel>
                      <FormControl>
                        <DateInputDDMMYY {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="horaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora início *</FormLabel>
                      <FormControl>
                        <TimeInputHHMM {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="duracao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (min)</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sessaoDuracaoOpcoes(field.value).map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d === SESSAO_DURACAO_MIN
                              ? `${duracaoSessaoLabel(d)} — sessão padrão`
                              : `${duracaoSessaoLabel(d)} (${d} min)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isMarcacaoSlot && (
                <FormField
                  control={form.control}
                  name="servico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de sessão</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Ex: Fisioterapia neurológica"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
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
    </DashboardPage>
  );
}
