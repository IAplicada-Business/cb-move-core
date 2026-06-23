import * as React from "react";
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
import type { Evolucao } from "@/lib/queries/prontuario";

type FormState = {
  data: string;
  fisioterapeuta_id: string;
  subjetivo: string;
  objetivo: string;
  plano: string;
  fonte: "manual" | "audio_ia" | "sites_import";
};

type Props = {
  evolucao?: Partial<Evolucao>;
  fisios: Array<{ id: string; nome: string }>;
  pacienteId: string;
  onSave: (ev: Partial<Evolucao>) => void;
  onCancel: () => void;
  loading?: boolean;
};

export function EvolucaoEditor({ evolucao, fisios, pacienteId, onSave, onCancel, loading }: Props) {
  const [form, setForm] = React.useState<FormState>({
    data: evolucao?.data ?? new Date().toISOString().split("T")[0],
    fisioterapeuta_id: evolucao?.fisioterapeuta_id ?? "",
    subjetivo: evolucao?.subjetivo ?? "",
    objetivo: evolucao?.objetivo ?? "",
    plano: evolucao?.plano ?? "",
    fonte: evolucao?.fonte ?? "manual",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <input
            type="date"
            className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
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
              fonte: "audio_ia",
            }))
          }
        />
      </div>

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
        <Button onClick={() => onSave(form)} disabled={loading}>
          {loading ? "Salvando..." : "Salvar evolução"}
        </Button>
      </div>
    </div>
  );
}
