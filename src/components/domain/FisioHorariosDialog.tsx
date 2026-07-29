import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DateInputDDMMYY } from "@/components/domain/DateInputDDMMYY";
import { TimeInputHHMM } from "@/components/domain/TimeInputHHMM";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeDDMMYY, parseDDMMYYToISO } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import {
  createFisioIndisponibilidade,
  deleteFisioDisponibilidade,
  deleteFisioIndisponibilidade,
  fetchFisioDisponibilidade,
  fetchFisioIndisponibilidade,
  MOTIVO_INDISP_LABEL,
  upsertFisioDisponibilidade,
  type FisioIndisponibilidade,
} from "@/lib/queries/fisio-horarios";

const DIAS_LABEL = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

type Fisio = { id: string; nome: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fisios: Fisio[];
};

export function FisioHorariosDialog({ open, onOpenChange, fisios }: Props) {
  const qc = useQueryClient();
  const [fisioId, setFisioId] = useState("");
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");

  const [indispDataInicio, setIndispDataInicio] = useState("");
  const [indispHoraInicio, setIndispHoraInicio] = useState("08:00");
  const [indispDataFim, setIndispDataFim] = useState("");
  const [indispHoraFim, setIndispHoraFim] = useState("18:00");
  const [motivo, setMotivo] = useState<FisioIndisponibilidade["motivo"]>("ferias");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!fisioId && fisios[0]?.id) setFisioId(fisios[0].id);
  }, [fisios, fisioId]);

  const selectedFisio = fisioId || fisios[0]?.id || "";

  const periodoIndisp = useMemo(() => {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fim = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);
    return {
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
    };
  }, []);

  const { data: disponibilidade = [] } = useQuery({
    queryKey: queryKeys.fisioHorarios.disponibilidade(selectedFisio || undefined),
    queryFn: () => fetchFisioDisponibilidade(selectedFisio || undefined),
    enabled: open && !!selectedFisio,
  });

  const { data: indisponibilidade = [] } = useQuery({
    queryKey: queryKeys.fisioHorarios.indisponibilidade(
      periodoIndisp.inicio,
      periodoIndisp.fim,
      selectedFisio || undefined,
    ),
    queryFn: () =>
      fetchFisioIndisponibilidade({
        inicio: periodoIndisp.inicio,
        fim: periodoIndisp.fim,
        fisioterapeutaId: selectedFisio || undefined,
      }),
    enabled: open && !!selectedFisio,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.fisioHorarios.all });
  };

  const saveDisp = useMutation({
    mutationFn: () =>
      upsertFisioDisponibilidade({
        fisioterapeuta_id: selectedFisio,
        dia_semana: Number(diaSemana),
        hora_inicio: horaInicio,
        hora_fim: horaFim,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Disponibilidade salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeDisp = useMutation({
    mutationFn: (id: string) => deleteFisioDisponibilidade(id),
    onSuccess: () => {
      invalidate();
      toast.success("Disponibilidade removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveIndisp = useMutation({
    mutationFn: () => {
      const di = parseDDMMYYToISO(indispDataInicio);
      const df = parseDDMMYYToISO(indispDataFim);
      if (!di || !df) throw new Error("Datas inválidas — use dd/mm/aa");
      if (!/^\d{2}:\d{2}$/.test(indispHoraInicio) || !/^\d{2}:\d{2}$/.test(indispHoraFim)) {
        throw new Error("Horas inválidas — use HH:mm");
      }
      return createFisioIndisponibilidade({
        fisioterapeuta_id: selectedFisio,
        inicio: `${di}T${indispHoraInicio}:00-03:00`,
        fim: `${df}T${indispHoraFim}:00-03:00`,
        motivo,
        observacoes: obs.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Indisponibilidade registrada");
      setObs("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeIndisp = useMutation({
    mutationFn: (id: string) => deleteFisioIndisponibilidade(id),
    onSuccess: () => {
      invalidate();
      toast.success("Bloqueio removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dispDoFisio = disponibilidade.filter((d) => d.fisioterapeuta_id === selectedFisio);
  const indispDoFisio = indisponibilidade.filter((d) => d.fisioterapeuta_id === selectedFisio);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Horários / Indisponibilidade</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <div className="space-y-1.5">
            <Label>Fisioterapeuta</Label>
            <Select
              value={selectedFisio}
              onValueChange={(v) => {
                setFisioId(v);
              }}
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

          <section className="space-y-3 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">Disponibilidade semanal</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Faixas recorrentes Seg–Sex. Cada bloco da grade ={" "}
                <strong className="font-semibold text-foreground">1h25 (85 min)</strong>, com 3
                intervalos fixos entre os horários.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Dia</Label>
                <Select value={diaSemana} onValueChange={setDiaSemana}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {DIAS_LABEL[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Início</Label>
                <TimeInputHHMM value={horaInicio} onChange={setHoraInicio} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <TimeInputHHMM value={horaFim} onChange={setHoraFim} />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  className="w-full"
                  disabled={!selectedFisio || saveDisp.isPending}
                  onClick={() => saveDisp.mutate()}
                >
                  Adicionar
                </Button>
              </div>
            </div>

            {dispDoFisio.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma faixa cadastrada.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {dispDoFisio.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {DIAS_LABEL[d.dia_semana]} · {String(d.hora_inicio).slice(0, 5)}–
                      {String(d.hora_fim).slice(0, 5)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDisp.mutate(d.id)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">Indisponibilidade pontual</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bloqueios de férias, intervalos ou outros períodos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data início</Label>
                <DateInputDDMMYY value={indispDataInicio} onChange={setIndispDataInicio} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora início</Label>
                <TimeInputHHMM value={indispHoraInicio} onChange={setIndispHoraInicio} />
              </div>
              <div className="space-y-1.5">
                <Label>Data fim</Label>
                <DateInputDDMMYY value={indispDataFim} onChange={setIndispDataFim} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fim</Label>
                <TimeInputHHMM value={indispHoraFim} onChange={setIndispHoraFim} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Motivo</Label>
                <Select
                  value={motivo}
                  onValueChange={(v) => setMotivo(v as FisioIndisponibilidade["motivo"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(MOTIVO_INDISP_LABEL) as Array<FisioIndisponibilidade["motivo"]>
                    ).map((m) => (
                      <SelectItem key={m} value={m}>
                        {MOTIVO_INDISP_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={2}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <Button
              type="button"
              disabled={!selectedFisio || saveIndisp.isPending}
              onClick={() => saveIndisp.mutate()}
            >
              Registrar bloqueio
            </Button>

            {indispDoFisio.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum bloqueio no período.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {indispDoFisio.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2 px-3 py-2">
                    <div>
                      <p className="font-medium">{MOTIVO_INDISP_LABEL[item.motivo]}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTimeDDMMYY(item.inicio)} → {formatDateTimeDDMMYY(item.fim)}
                      </p>
                      {item.observacoes && <p className="text-xs mt-0.5">{item.observacoes}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeIndisp.mutate(item.id)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
