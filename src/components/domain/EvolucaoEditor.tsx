import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { EvolucaoAudioRecorder } from "@/components/domain/EvolucaoAudioRecorder";
import { resolveSessaoId, sessaoOptionLabel } from "@/components/domain/prontuario/utils";
import { fetchSessoesDoDia, type Evolucao } from "@/lib/queries/prontuario";

type FormState = {
  data: string;
  fisioterapeuta_id: string;
  sessao_id: string;
  subjetivo: string;
  objetivo: string;
  plano: string;
  transcricao_raw: string;
  fonte: "manual" | "audio_ia" | "sites_import";
};

type Props = {
  evolucao?: Partial<Evolucao>;
  fisios: Array<{ id: string; nome: string }>;
  pacienteId: string;
  defaultFisioterapeutaId?: string | null;
  onSave: (ev: Partial<Evolucao>) => void;
  onCancel: () => void;
  loading?: boolean;
};

function buildInitialForm(
  evolucao: Partial<Evolucao> | undefined,
  defaultFisioterapeutaId?: string | null,
): FormState {
  const subjetivo = evolucao?.subjetivo ?? "";
  const objetivo = evolucao?.objetivo ?? "";
  const plano = evolucao?.plano ?? "";
  const transcricao_raw = evolucao?.transcricao_raw ?? "";
  const soapVazio = !subjetivo.trim() && !objetivo.trim() && !plano.trim();
  const subjetivoFinal =
    soapVazio && transcricao_raw.trim() ? transcricao_raw.trim() : subjetivo;

  return {
    data: evolucao?.data ?? new Date().toISOString().split("T")[0],
    fisioterapeuta_id: evolucao?.fisioterapeuta_id ?? defaultFisioterapeutaId ?? "",
    sessao_id: evolucao?.sessao_id ?? "",
    subjetivo: subjetivoFinal,
    objetivo,
    plano,
    transcricao_raw,
    fonte: evolucao?.fonte ?? "manual",
  };
}

export function EvolucaoEditor({
  evolucao,
  fisios,
  pacienteId,
  defaultFisioterapeutaId,
  onSave,
  onCancel,
  loading,
}: Props) {
  const [form, setForm] = React.useState<FormState>(() =>
    buildInitialForm(evolucao, defaultFisioterapeutaId),
  );

  const evolucaoDraftKey = [
    evolucao?.id ?? "",
    evolucao?.transcricao_raw ?? "",
    evolucao?.subjetivo ?? "",
    evolucao?.objetivo ?? "",
    evolucao?.plano ?? "",
  ].join("|");

  React.useEffect(() => {
    setForm(buildInitialForm(evolucao, defaultFisioterapeutaId));
  }, [evolucaoDraftKey, defaultFisioterapeutaId]);

  const sessoesDoDiaQuery = useQuery({
    queryKey: ["prontuario", "sessoes-dia", pacienteId, form.data],
    queryFn: () => fetchSessoesDoDia(pacienteId, form.data),
    enabled: !!pacienteId && !!form.data,
  });

  const sessoesDoDia = sessoesDoDiaQuery.data ?? [];

  React.useEffect(() => {
    if (sessoesDoDiaQuery.isLoading) return;

    if (sessoesDoDia.length === 0) {
      setForm((f) => (f.sessao_id ? { ...f, sessao_id: "" } : f));
      return;
    }

    const currentStillValid = sessoesDoDia.some((s) => s.id === form.sessao_id);
    if (currentStillValid) return;

    const resolved = resolveSessaoId(sessoesDoDia);
    if (resolved) {
      setForm((f) => ({ ...f, sessao_id: resolved }));
    }
  }, [sessoesDoDia, sessoesDoDiaQuery.isLoading, form.sessao_id]);

  function handleSave() {
    const hasContent =
      form.subjetivo.trim() ||
      form.objetivo.trim() ||
      form.plano.trim() ||
      form.transcricao_raw.trim();
    if (!hasContent) {
      toast.error("Preencha ao menos um campo S/O/P ou mantenha a transcrição");
      return;
    }

    onSave({
      data: form.data,
      fisioterapeuta_id: form.fisioterapeuta_id || null,
      sessao_id: form.sessao_id || null,
      subjetivo: form.subjetivo.trim() || null,
      objetivo: form.objetivo.trim() || null,
      plano: form.plano.trim() || null,
      transcricao_raw: form.transcricao_raw.trim() || null,
      fonte: form.fonte,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <input
            type="date"
            className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value, sessao_id: "" }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Fisioterapeuta</Label>
          <Select
            value={form.fisioterapeuta_id}
            onValueChange={(v) => setForm((f) => ({ ...f, fisioterapeuta_id: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
      </div>

      {sessoesDoDia.length > 1 && (
        <div className="space-y-1.5">
          <Label>Sessão do dia</Label>
          <Select
            value={form.sessao_id}
            onValueChange={(v) => setForm((f) => ({ ...f, sessao_id: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a sessão" />
            </SelectTrigger>
            <SelectContent>
              {sessoesDoDia.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {sessaoOptionLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {sessoesDoDia.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Sessão vinculada: {sessaoOptionLabel(sessoesDoDia[0])}
        </p>
      )}

      {sessoesDoDia.length === 0 && !sessoesDoDiaQuery.isLoading && (
        <p className="text-xs text-muted-foreground">
          Nenhuma sessão registrada nesta data — a evolução será salva sem vínculo.
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Transcrição por voz (IA)</Label>
        <EvolucaoAudioRecorder
          pacienteId={pacienteId}
          onResult={(r) =>
            setForm((f) => ({
              ...f,
              subjetivo: r.subjetivo || f.subjetivo,
              objetivo: r.objetivo || f.objetivo,
              plano: r.plano || f.plano,
              transcricao_raw: r.transcricao_raw || f.transcricao_raw,
              fonte: "audio_ia",
            }))
          }
        />
      </div>

      {form.transcricao_raw.trim() && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground max-h-24 overflow-y-auto">
          <span className="font-semibold text-foreground">Transcrição: </span>
          {form.transcricao_raw}
        </div>
      )}

      {(["subjetivo", "objetivo", "plano"] as const).map((campo) => (
        <div key={campo} className="space-y-1.5">
          <Label className="uppercase text-xs tracking-wider text-muted-foreground font-semibold">
            {campo === "subjetivo"
              ? "S — Subjetivo"
              : campo === "objetivo"
              ? "O — Objetivo"
              : "P — Plano"}
          </Label>
          <Textarea
            value={form[campo]}
            onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
            className="min-h-[90px] resize-y"
            placeholder={
              campo === "subjetivo"
                ? "Queixa principal, relato do paciente..."
                : campo === "objetivo"
                ? "Dados clínicos, escalas, medidas..."
                : "Condutas, exercícios, objetivos da próxima sessão..."
            }
          />
        </div>
      ))}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Salvando..." : "Salvar evolução"}
        </Button>
      </div>
    </div>
  );
}
