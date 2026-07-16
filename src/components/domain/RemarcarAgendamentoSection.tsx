import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgendaMenuSection } from "@/components/domain/AgendaMenuSection";
import { RemarcarSemanaDestinoGrid } from "@/components/domain/RemarcarSemanaDestinoGrid";
import { Button } from "@/components/ui/button";
import {
  calcularSemanaDestino,
  defaultDestinoRemarcar,
  idsExcluirRemarcacao,
  sugerirDatasPlano,
  type SlotRemarcacaoSelecionado,
} from "@/lib/domain/remarcacao-disponibilidade";
import { parseDDMMYYToISO } from "@/lib/format";
import { fetchAgendamentosPeriodo } from "@/lib/queries/agenda";
import {
  fetchFisioDisponibilidade,
  fetchFisioIndisponibilidade,
} from "@/lib/queries/fisio-horarios";
import { queryKeys } from "@/lib/queries";
import { fetchPlanoSessoesMensalPaciente } from "@/lib/queries/plano-sessoes";

type AgendamentoRef = {
  id: string;
  inicio: string;
  paciente_id: string | null;
  fisioterapeuta_id: string | null;
  duracao_min: number;
  status: string;
  serie_id?: string | null;
};

type Props = {
  target: AgendamentoRef;
  onAbrirRemarcar: (prefill?: SlotRemarcacaoSelecionado) => void;
};

export function RemarcarAgendamentoSection({ target, onAbrirRemarcar }: Props) {
  const [open, setOpen] = useState(false);
  const destinoInicial = useMemo(() => defaultDestinoRemarcar(target.inicio), [target.inicio]);
  const [slotLocal, setSlotLocal] = useState<SlotRemarcacaoSelecionado | null>(() => {
    const iso = parseDDMMYYToISO(destinoInicial.data);
    return iso ? { dataIso: iso, horaInicio: destinoInicial.horaInicio } : null;
  });

  const dataIso = slotLocal?.dataIso ?? "";
  const fisioId = target.fisioterapeuta_id ?? "";

  const semanaDestino = useMemo(
    () => (dataIso ? calcularSemanaDestino(dataIso) : null),
    [dataIso],
  );

  const competencia = useMemo(() => {
    const d = new Date(target.inicio);
    return { mes: d.getMonth() + 1, ano: d.getFullYear() };
  }, [target.inicio]);

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
    queryKey: ["fisio-disp-remarcar-menu", fisioId],
    queryFn: () => fetchFisioDisponibilidade(fisioId || undefined),
    enabled: open && !!fisioId,
  });

  const { data: indisponibilidades = [] } = useQuery({
    queryKey: queryKeys.fisioHorarios.indisponibilidade(
      semanaDestino?.inicio ?? "",
      semanaDestino?.fim ?? "",
      fisioId || undefined,
    ),
    queryFn: () =>
      fetchFisioIndisponibilidade({
        inicio: semanaDestino!.inicio,
        fim: semanaDestino!.fim,
        fisioterapeutaId: fisioId || undefined,
      }),
    enabled: open && !!semanaDestino && !!fisioId,
  });

  const { data: plano } = useQuery({
    queryKey: queryKeys.sessoes.planoMensal(
      target.paciente_id ?? "",
      competencia.mes,
      competencia.ano,
    ),
    queryFn: () =>
      fetchPlanoSessoesMensalPaciente(
        target.paciente_id!,
        competencia.mes,
        competencia.ano,
      ),
    enabled: open && !!target.paciente_id,
  });

  const datasPlano = useMemo(() => {
    if (!plano) return new Set<string>();
    return new Set(sugerirDatasPlano(plano));
  }, [plano]);

  const excluirIds = useMemo(
    () =>
      idsExcluirRemarcacao(
        target.id,
        "pontual",
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
      ),
    [target, agendamentosSemana],
  );

  const slotSelecionado = slotLocal;

  useEffect(() => {
    setOpen(false);
    const d = defaultDestinoRemarcar(target.inicio);
    const iso = parseDDMMYYToISO(d.data);
    setSlotLocal(iso ? { dataIso: iso, horaInicio: d.horaInicio } : null);
  }, [target.id, target.inicio]);

  return (
    <AgendaMenuSection
      title="Remarcar agendamento"
      subtitle="Clique em um horário vago na grade"
      open={open}
      onOpenChange={setOpen}
    >
      {semanaDestino && fisioId ? (
        <RemarcarSemanaDestinoGrid
          key={semanaDestino.inicio}
          fisioId={fisioId}
          diasUteis={semanaDestino.diasUteis}
          disponibilidade={disponibilidade}
          indisponibilidades={indisponibilidades}
          agendamentos={agendamentosSemana}
          excluirIds={excluirIds}
          datasPlano={datasPlano}
          slotSelecionado={slotSelecionado}
          onPickSlot={(slot) => onAbrirRemarcar(slot)}
          onDaySelect={(iso) => {
            setSlotLocal((prev) => ({
              dataIso: iso,
              horaInicio: prev?.horaInicio ?? destinoInicial.horaInicio,
            }));
          }}
        />
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Carregando grade da semana…
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        onClick={() => onAbrirRemarcar()}
      >
        Abrir assistente completo
      </Button>
    </AgendaMenuSection>
  );
}
