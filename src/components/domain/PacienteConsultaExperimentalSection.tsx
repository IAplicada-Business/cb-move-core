import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { queryKeys } from "@/lib/queries/keys";
import { updateConsultaExperimental, type Paciente } from "@/lib/queries/pacientes";
import { fetchFisios } from "@/lib/queries/fisioterapeutas";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ConsultaExperimentalDraft = {
  data: string;
  fisioId: string;
  observacoes: string;
};

export function emptyConsultaExperimentalDraft(): ConsultaExperimentalDraft {
  return { data: "", fisioId: "", observacoes: "" };
}

export function consultaDraftFromPaciente(p: Paciente): ConsultaExperimentalDraft {
  return {
    data: p.consultaExperimentalEm ?? "",
    fisioId: p.consultaExperimentalFisioId ?? "",
    observacoes: p.consultaExperimentalObservacoes ?? "",
  };
}

export function hasConsultaExperimentalDraft(d: ConsultaExperimentalDraft): boolean {
  return !!(d.data || d.fisioId || d.observacoes.trim());
}

type Props = {
  value: ConsultaExperimentalDraft;
  onChange: (value: ConsultaExperimentalDraft) => void;
  /** Informado na edição — habilita salvar imediato no banco */
  pacienteId?: string;
  /** Dentro do dialog de cadastro — estilo compacto */
  embedded?: boolean;
  onSaved?: (
    patch: Pick<
      Paciente,
      "consultaExperimentalEm" | "consultaExperimentalFisioId" | "consultaExperimentalObservacoes"
    >,
  ) => void;
};

export function PacienteConsultaExperimentalSection({
  value,
  onChange,
  pacienteId,
  embedded,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const { data, fisioId, observacoes: obs } = value;

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: fetchFisios,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!pacienteId) throw new Error("Paciente ainda não cadastrado");
      return updateConsultaExperimental(pacienteId, {
        consultaExperimentalEm: data || null,
        consultaExperimentalFisioId: fisioId || null,
        consultaExperimentalObservacoes: obs.trim() || null,
      });
    },
    onSuccess: () => {
      if (!pacienteId) return;
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.byId(pacienteId) });
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.all });
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(pacienteId) });
      onSaved?.({
        consultaExperimentalEm: data || null,
        consultaExperimentalFisioId: fisioId || null,
        consultaExperimentalObservacoes: obs.trim() || null,
      });
      toast.success("Primeira Consulta Experimental registrada no cadastro e no prontuário");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const realizada = !!data;

  const wrapperClass = embedded
    ? "space-y-3 rounded-lg border bg-muted/20 p-3"
    : "rounded-xl border bg-card p-5 space-y-4";

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={
              embedded
                ? "text-sm font-semibold text-foreground flex items-center gap-2"
                : "text-lg font-semibold text-foreground flex items-center gap-2"
            }
          >
            <Stethoscope
              className={embedded ? "h-4 w-4 text-cb-cyan-600" : "h-5 w-5 text-cb-cyan-600"}
            />
            Primeira Consulta Experimental
          </h2>
          <p
            className={
              embedded ? "text-xs text-muted-foreground mt-1" : "text-sm text-muted-foreground mt-1"
            }
          >
            Avaliação inicial avulsa antes de iniciar a periodização regular do tratamento.
            {!pacienteId && " Será salva junto com o cadastro do paciente."}
          </p>
        </div>
        {realizada && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <Calendar className="h-3.5 w-3.5" />
            {pacienteId ? `Realizada em ${formatDate(data)}` : `Prevista para ${formatDate(data)}`}
          </span>
        )}
      </div>

      <div className={embedded ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>
        <div>
          <Label htmlFor="consulta-data">Data da consulta</Label>
          <Input
            id="consulta-data"
            type="date"
            value={data}
            onChange={(e) => onChange({ ...value, data: e.target.value })}
          />
        </div>
        <div>
          <Label>Fisioterapeuta avaliador</Label>
          <Select
            value={fisioId || "__none__"}
            onValueChange={(v) => onChange({ ...value, fisioId: v === "__none__" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {fisios
                .filter((f) => f.ativo)
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="consulta-obs">Observações da avaliação</Label>
          <Textarea
            id="consulta-obs"
            rows={3}
            value={obs}
            onChange={(e) => onChange({ ...value, observacoes: e.target.value })}
            placeholder="Motivo clínico, achados iniciais, encaminhamento para periodização…"
          />
        </div>
      </div>

      {pacienteId && (
        <div className="flex justify-end">
          <Button
            type="button"
            size={embedded ? "sm" : "default"}
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar consulta experimental"}
          </Button>
        </div>
      )}
    </div>
  );
}
