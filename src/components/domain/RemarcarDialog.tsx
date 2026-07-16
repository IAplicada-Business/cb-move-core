import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";import { toast } from "sonner";
import { DateInputDDMMYY } from "@/components/domain/DateInputDDMMYY";
import { TimeInputHHMM } from "@/components/domain/TimeInputHHMM";
import { RemarcarSemanaDestinoGrid } from "@/components/domain/RemarcarSemanaDestinoGrid";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  avaliarDestinoRemarcacao,
  calcularSemanaDestino,
  defaultDestinoRemarcar,
  idsExcluirRemarcacao,
  sugerirDatasPlano,
  type SlotRemarcacaoSelecionado,
} from "@/lib/domain/remarcacao-disponibilidade";
import { simularRemarcacaoImpacto } from "@/lib/domain/simular-remarcacao-impacto";
import {
  formatDateDDMMYY,
  formatDateTimeDDMMYY,
  isoToDDMMYY,
  parseDDMMYYToISO,
} from "@/lib/format";
import {
  contarEscopoRemanejamento,
  fetchAgendamentosPeriodo,
  fetchAgendamentoPorId,
  remarcarAgendamento,
  type AgendamentoDetalhe,
  type EscopoRemanejamento,
} from "@/lib/queries/agenda";
import {
  fetchFisioDisponibilidade,
  fetchFisioIndisponibilidade,
} from "@/lib/queries/fisio-horarios";
import { queryKeys } from "@/lib/queries";
import { fetchAgendamentosAtivosPacienteMes, fetchPlanoSessoesMensalPaciente } from "@/lib/queries/plano-sessoes";
import { fetchSessaoSiglaDia } from "@/lib/queries/sessoes";
import { cn } from "@/lib/utils";

type RemarcarFormValues = {
  data: string;
  horaInicio: string;
  fisioId: string;
  duracao: number;
  escopo: EscopoRemanejamento;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: AgendamentoDetalhe | null;
  fisios: { id: string; nome: string }[];
  usuarioId?: string | null;
  prefillSlot?: SlotRemarcacaoSelecionado | null;
  onRemarcado?: (ag: AgendamentoDetalhe) => void;
};

function sameIsoWeek(a: Date, b: Date): boolean {
  const start = (d: Date) => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  return start(a).getTime() === start(b).getTime();
}

export function RemarcarDialog({
  open,
  onOpenChange,
  target,
  fisios,
  usuarioId,
  prefillSlot,
  onRemarcado,
}: Props) {
  const qc = useQueryClient();

  const form = useForm<RemarcarFormValues>({
    defaultValues: {
      data: "",
      horaInicio: "09:00",
      fisioId: "",
      duracao: 50,
      escopo: "pontual",
    },
  });

  const dataWatch = form.watch("data");
  const horaWatch = form.watch("horaInicio");
  const fisioWatch = form.watch("fisioId");
  const escopoWatch = form.watch("escopo");
  const duracaoWatch = form.watch("duracao");

  const dataIso = useMemo(() => parseDDMMYYToISO(dataWatch) ?? "", [dataWatch]);

  const semanaDestino = useMemo(
    () => (dataIso ? calcularSemanaDestino(dataIso) : null),
    [dataIso],
  );

  const { data: agendamentosSemana = [] } = useQuery({
    queryKey: queryKeys.agendamentos.periodo(
      semanaDestino?.inicio ?? "",
      semanaDestino?.fim ?? "",
    ),
    queryFn: () =>
      fetchAgendamentosPeriodo(semanaDestino!.inicio, semanaDestino!.fim),
    enabled: open && !!semanaDestino,
  });

  const { data: disponibilidade = [] } = useQuery({
    queryKey: ["fisio-disp-remarcar", fisioWatch],
    queryFn: () => fetchFisioDisponibilidade(fisioWatch || undefined),
    enabled: open && !!fisioWatch,
  });

  const { data: indisponibilidades = [] } = useQuery({
    queryKey: queryKeys.fisioHorarios.indisponibilidade(
      semanaDestino?.inicio ?? "",
      semanaDestino?.fim ?? "",
      fisioWatch || undefined,
    ),
    queryFn: () =>
      fetchFisioIndisponibilidade({
        inicio: semanaDestino!.inicio,
        fim: semanaDestino!.fim,
        fisioterapeutaId: fisioWatch || undefined,
      }),
    enabled: open && !!semanaDestino && !!fisioWatch,
  });

  const competencia = useMemo(() => {
    if (!target?.inicio) return null;
    const d = new Date(target.inicio);
    return { mes: d.getMonth() + 1, ano: d.getFullYear() };
  }, [target?.inicio]);

  const { data: planoRemarcar } = useQuery({
    queryKey: queryKeys.sessoes.planoMensal(
      target?.paciente_id ?? "",
      competencia?.mes ?? 0,
      competencia?.ano ?? 0,
    ),
    queryFn: () =>
      fetchPlanoSessoesMensalPaciente(
        target!.paciente_id!,
        competencia!.mes,
        competencia!.ano,
      ),
    enabled: open && !!target?.paciente_id && !!competencia,
  });

  const { data: agendamentosRemarcar = [] } = useQuery({
    queryKey: [
      "agendamentos-remarcar-impacto",
      target?.paciente_id,
      competencia?.mes,
      competencia?.ano,
    ],
    queryFn: () =>
      fetchAgendamentosAtivosPacienteMes(
        target!.paciente_id!,
        competencia!.mes,
        competencia!.ano,
      ),
    enabled: open && !!target?.paciente_id && !!competencia,
  });

  const { data: contagensEscopo } = useQuery({
    queryKey: ["agenda-escopo-counts", target?.id],
    queryFn: async () => {
      const [pontual, semana, serie_mes] = await Promise.all([
        contarEscopoRemanejamento(target!.id, "pontual"),
        contarEscopoRemanejamento(target!.id, "semana"),
        contarEscopoRemanejamento(target!.id, "serie_mes"),
      ]);
      return { pontual, semana, serie_mes };
    },
    enabled: open && !!target,
  });

  const dataOrigem = target?.inicio.slice(0, 10) ?? "";

  const { data: siglaDiaOrigem = null } = useQuery({
    queryKey: queryKeys.sessoes.siglaDia(target?.paciente_id ?? "", dataOrigem),
    queryFn: () => fetchSessaoSiglaDia(target!.paciente_id!, dataOrigem),
    enabled: open && !!target?.paciente_id && !!dataOrigem,
  });

  const { data: siglaDiaDestino = null } = useQuery({
    queryKey: queryKeys.sessoes.siglaDia(target?.paciente_id ?? "", dataIso),
    queryFn: () => fetchSessaoSiglaDia(target!.paciente_id!, dataIso),
    enabled: open && !!target?.paciente_id && !!dataIso && dataIso !== dataOrigem,
  });

  const datasPlano = useMemo(() => {
    if (!planoRemarcar) return new Set<string>();
    return new Set(sugerirDatasPlano(planoRemarcar));
  }, [planoRemarcar]);

  const excluirIds = useMemo(() => {
    if (!target) return new Set<string>();
    return idsExcluirRemarcacao(
      target.id,
      escopoWatch,
      agendamentosSemana.map((a) => ({
        id: a.id,
        inicio: a.inicio,
        paciente_id: a.paciente_id,
        serie_id: a.serie_id,
      })),
      {
        id: target.id,
        inicio: target.inicio,
        paciente_id: target.paciente_id,
        serie_id: target.serie_id,
      },
    );
  }, [target, escopoWatch, agendamentosSemana]);

  const preview = useMemo(() => {
    if (!target || !dataIso || !/^\d{2}:\d{2}$/.test(horaWatch)) return null;
    const novoInicio = `${dataIso}T${horaWatch}:00-03:00`;
    const origem = new Date(target.inicio);
    const destino = new Date(novoInicio);
    const deltaDias = Math.round((destino.getTime() - origem.getTime()) / 86_400_000);
    return {
      novoInicio,
      deltaDias,
      cruzaSemana: !sameIsoWeek(origem, destino),
      destinoLabel: formatDateTimeDDMMYY(novoInicio),
    };
  }, [target, dataIso, horaWatch]);

  const avaliacao = useMemo(() => {
    if (!target || !preview || !fisioWatch) return null;
    return avaliarDestinoRemarcacao({
      fisioId: fisioWatch,
      dataIso,
      horaInicio: horaWatch,
      duracaoMin: duracaoWatch,
      novoInicio: preview.novoInicio,
      disponibilidade,
      indisponibilidades,
      agendamentos: agendamentosSemana,
      excluirIds,
      datasPlano,
    });
  }, [
    target,
    preview,
    fisioWatch,
    dataIso,
    horaWatch,
    duracaoWatch,
    disponibilidade,
    indisponibilidades,
    agendamentosSemana,
    excluirIds,
    datasPlano,
  ]);

  const impactoRemarcar = useMemo(() => {
    if (!target || !preview || !planoRemarcar) return null;
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
        id: target.id,
        inicio: target.inicio,
        status: target.status,
        serie_id: target.serie_id,
      },
      novoInicio: preview.novoInicio,
      escopo: escopoWatch,
    });
  }, [target, preview, planoRemarcar, agendamentosRemarcar, escopoWatch]);

  const slotSelecionado: SlotRemarcacaoSelecionado | null =
    dataIso && horaWatch ? { dataIso, horaInicio: horaWatch } : null;

  const mutation = useMutation({
    mutationFn: (vals: RemarcarFormValues) => {
      if (!target) throw new Error("Agendamento não selecionado");
      const isoDate = parseDDMMYYToISO(vals.data);
      if (!isoDate) throw new Error("Data inválida — use dd/mm/aa");
      if (!/^\d{2}:\d{2}$/.test(vals.horaInicio)) throw new Error("Hora inválida — use HH:mm");
      return remarcarAgendamento({
        agendamentoId: target.id,
        novoInicio: `${isoDate}T${vals.horaInicio}:00-03:00`,
        novoFisioId: vals.fisioId || undefined,
        duracaoMin: vals.duracao,
        escopo: vals.escopo,
        usuarioId: usuarioId ?? null,
      });
    },
    onSuccess: async (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos.all });
      qc.invalidateQueries({ queryKey: ["agendamento-historico"] });
      qc.invalidateQueries({ queryKey: queryKeys.sessoes.all });
      if (target?.paciente_id && competencia) {
        qc.invalidateQueries({
          queryKey: queryKeys.sessoes.planoMensal(
            target.paciente_id,
            competencia.mes,
            competencia.ano,
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
      onOpenChange(false);

      if (result.primeiroNovoId) {
        const ag = await fetchAgendamentoPorId(result.primeiroNovoId);
        onRemarcado?.(ag);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeConfirmar = !!preview && (avaliacao?.ok ?? false) && !mutation.isPending;
  const temImpactoPlano =
    !!impactoRemarcar?.usaSlots && (impactoRemarcar.avisos.length ?? 0) > 0;
  const [impactoOpen, setImpactoOpen] = useState(false);

  useEffect(() => {
    if (temImpactoPlano) setImpactoOpen(true);
  }, [temImpactoPlano]);

  useEffect(() => {
    if (open && target) {
      const destino = prefillSlot
        ? {
            data: isoToDDMMYY(prefillSlot.dataIso),
            horaInicio: prefillSlot.horaInicio,
          }
        : defaultDestinoRemarcar(target.inicio);
      form.reset({
        data: destino.data,
        horaInicio: destino.horaInicio,
        fisioId: target.fisioterapeuta_id ?? "",
        duracao: target.duracao_min,
        escopo: "pontual",
      });
    }
  }, [open, target, prefillSlot, form]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) mutation.reset();
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 pb-4 pt-6 pr-12">
          <DialogTitle>Remarcar agendamento</DialogTitle>
          {target && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {target.pacientes?.nome ?? "Paciente"}
              </span>
              {" · de "}
              {formatDateTimeDDMMYY(target.inicio)}
              {" → escolha o novo horário abaixo"}
            </p>
          )}
        </DialogHeader>
        {target && (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit((vals) => mutation.mutate(vals))}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-1.5">
                <Label>Fisioterapeuta</Label>
                <Select
                  value={fisioWatch}
                  onValueChange={(v) => form.setValue("fisioId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {fisios.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="remarcar-data">Nova data</Label>
                  <div
                    className={cn(
                      "rounded-md",
                      avaliacao?.alertaTipo === "erro" && "ring-1 ring-destructive/40",
                    )}
                  >
                    <Controller
                      control={form.control}
                      name="data"
                      render={({ field }) => (
                        <DateInputDDMMYY id="remarcar-data" {...field} />
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="remarcar-hora">Hora</Label>
                  <div
                    className={cn(
                      "rounded-md",
                      avaliacao?.alertaTipo === "erro" && "ring-1 ring-destructive/40",
                    )}
                  >
                    <Controller
                      control={form.control}
                      name="horaInicio"
                      render={({ field }) => (
                        <TimeInputHHMM id="remarcar-hora" {...field} />
                      )}
                    />
                  </div>
                </div>
              </div>

              {semanaDestino && fisioWatch ? (
                <RemarcarSemanaDestinoGrid
                  key={semanaDestino.inicio}
                  fisioId={fisioWatch}
                  diasUteis={semanaDestino.diasUteis}
                  disponibilidade={disponibilidade}
                  indisponibilidades={indisponibilidades}
                  agendamentos={agendamentosSemana}
                  excluirIds={excluirIds}
                  datasPlano={datasPlano}
                  slotSelecionado={slotSelecionado}
                  onPickSlot={(slot) => {
                    form.setValue("data", isoToDDMMYY(slot.dataIso));
                    form.setValue("horaInicio", slot.horaInicio);
                  }}
                  onDaySelect={(iso) => {
                    form.setValue("data", isoToDDMMYY(iso));
                  }}
                />
              ) : (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Selecione o fisioterapeuta para ver a grade da semana.
                </p>
              )}

              {preview && (
                <div className="rounded-lg border border-cb-cyan-600/30 bg-cb-cyan-600/5 px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Novo horário selecionado
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDateDDMMYY(dataIso)} · {horaWatch}
                  </p>
                </div>
              )}

              {avaliacao?.alerta && (
                <p
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium",
                    avaliacao.alertaTipo === "erro"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-cb-orange/40 bg-cb-orange/5 text-cb-orange",
                  )}
                >
                  {avaliacao.alerta}
                </p>
              )}

              {preview && preview.cruzaSemana && (
                <p className="text-xs text-cb-orange font-medium">
                  A data cai em outra semana — após confirmar, a agenda abrirá nessa semana.
                </p>
              )}

              {preview && siglaDiaOrigem && preview.deltaDias !== 0 && (
                <p className="text-xs text-cb-orange font-medium">
                  {siglaDiaDestino
                    ? `Frequência (${siglaDiaOrigem}) será removida — o novo dia já tem ${siglaDiaDestino}.`
                    : `Frequência (${siglaDiaOrigem}) será movida para o novo dia${preview.cruzaSemana ? " (outra semana)" : ""}.`}
                </p>
              )}

              {temImpactoPlano && (
                <Collapsible open={impactoOpen} onOpenChange={setImpactoOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-cb-orange/30 bg-cb-orange/5 px-3 py-2 text-left text-xs font-medium text-cb-orange"
                    >
                      Impacto no plano mensal ({impactoRemarcar!.avisos.length})
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform", impactoOpen && "rotate-180")}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1 rounded-lg border border-cb-orange/20 px-3 py-2 text-xs">
                    {impactoRemarcar!.avisos.map((aviso) => (
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
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            <div className="shrink-0 space-y-3 border-t bg-background px-6 py-4">
              <div className="space-y-2">
                <Label>Escopo do remanejamento</Label>                <RadioGroup
                  value={escopoWatch}
                  onValueChange={(v) => form.setValue("escopo", v as EscopoRemanejamento)}
                  className="grid gap-2 md:grid-cols-3"
                >
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2">
                    <RadioGroupItem value="pontual" id="escopo-pontual" className="mt-0.5" />
                    <Label htmlFor="escopo-pontual" className="cursor-pointer font-normal leading-snug">
                      Só este horário
                      {contagensEscopo && (
                        <span className="ml-1 text-muted-foreground">
                          ({contagensEscopo.pontual})
                        </span>
                      )}
                    </Label>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2">
                    <RadioGroupItem value="semana" id="escopo-semana" className="mt-0.5" />
                    <Label htmlFor="escopo-semana" className="cursor-pointer font-normal leading-snug">
                      Demais futuros na mesma semana
                      {contagensEscopo && (
                        <span className="ml-1 text-muted-foreground">
                          ({contagensEscopo.semana})
                        </span>
                      )}
                    </Label>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2">
                    <RadioGroupItem value="serie_mes" id="escopo-mes" className="mt-0.5" />
                    <Label htmlFor="escopo-mes" className="cursor-pointer font-normal leading-snug">
                      Demais futuros até fim do mês
                      {contagensEscopo && (
                        <span className="ml-1 text-muted-foreground">
                          ({contagensEscopo.serie_mes})
                        </span>
                      )}
                    </Label>
                  </div>
                </RadioGroup>
                {preview && escopoWatch !== "pontual" && contagensEscopo && (
                  <p className="text-xs text-muted-foreground">
                    {escopoWatch === "semana"
                      ? contagensEscopo.semana
                      : contagensEscopo.serie_mes}{" "}
                    horário(s) serão deslocados pelo mesmo intervalo.
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Voltar
                </Button>
                <Button type="submit" disabled={!podeConfirmar}>
                  {mutation.isPending ? "Salvando…" : "Confirmar remarcação"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
