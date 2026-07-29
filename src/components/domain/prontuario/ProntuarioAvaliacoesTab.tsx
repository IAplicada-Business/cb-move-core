import { useState } from "react";
import { FlaskConical, Plus } from "lucide-react";
import { toast } from "sonner";

import { DashboardSection, DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  aplicarInstrumento,
  type InstrumentoAplicado,
  type InstrumentoClinico,
} from "@/lib/queries/prontuario";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function AplicarInstrumentoDialog({
  open,
  onOpenChange,
  instrumentos,
  pacienteId,
  aplicadoPor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instrumentos: InstrumentoClinico[];
  pacienteId: string;
  aplicadoPor?: string;
  onSaved: () => void;
}) {
  const [instrumentoId, setInstrumentoId] = useState("");
  const [resultados, setResultados] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const instrumento = instrumentos.find((i) => i.id === instrumentoId);

  async function handleSave() {
    if (!instrumento) return;
    setSaving(true);
    try {
      await aplicarInstrumento({
        pacienteId,
        instrumentoId: instrumento.id,
        versao: instrumento.versao,
        resultados,
        aplicadoPor,
      });
      toast.success("Instrumento aplicado com sucesso");
      onSaved();
      onOpenChange(false);
      setInstrumentoId("");
      setResultados({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function setField(id: string, value: string) {
    setResultados((r) => ({ ...r, [id]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar instrumento clínico</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Instrumento</Label>
            <Select
              value={instrumentoId}
              onValueChange={(v) => {
                setInstrumentoId(v);
                setResultados({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o instrumento" />
              </SelectTrigger>
              <SelectContent>
                {instrumentos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} ({i.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {instrumento?.campos.map((campo) => (
            <div key={campo.id} className="space-y-1.5">
              <Label>{campo.label}</Label>
              {campo.tipo === "select" && campo.opcoes ? (
                <Select
                  value={resultados[campo.id] ?? ""}
                  onValueChange={(v) => setField(campo.id, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {campo.opcoes.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : campo.tipo === "number" ? (
                <Input
                  type="number"
                  min={campo.min}
                  max={campo.max}
                  value={resultados[campo.id] ?? ""}
                  onChange={(e) => setField(campo.id, e.target.value)}
                />
              ) : campo.tipo === "textarea" ? (
                <Textarea
                  value={resultados[campo.id] ?? ""}
                  onChange={(e) => setField(campo.id, e.target.value)}
                  className="min-h-[80px] resize-y"
                />
              ) : (
                <Input
                  type="text"
                  value={resultados[campo.id] ?? ""}
                  onChange={(e) => setField(campo.id, e.target.value)}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !instrumentoId}>
              {saving ? "Salvando..." : "Registrar aplicação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  aplicados: InstrumentoAplicado[];
  instrumentos: InstrumentoClinico[];
  pacienteId: string;
  loading: boolean;
  canEdit: boolean;
  aplicadoPor?: string;
  onSaved: () => void;
};

export function ProntuarioAvaliacoesTab({
  aplicados,
  instrumentos,
  pacienteId,
  loading,
  canEdit,
  aplicadoPor,
  onSaved,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Avaliações clínicas</h2>
          <p className="text-xs text-muted-foreground">
            Instrumentos padronizados aplicados ao paciente
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Aplicar instrumento
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : aplicados.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title="Nenhuma avaliação registrada"
          description="Registre escalas e instrumentos de avaliação neurofuncional."
        />
      ) : (
        <DashboardSection
          eyebrow="Prontuário"
          accent="purple"
          title="Avaliações aplicadas"
          badge={<DashboardSectionBadge accent="purple">{aplicados.length}</DashboardSectionBadge>}
          noPadding
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrumento</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Data de aplicação</TableHead>
                <TableHead>Resultados (resumo)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aplicados.map((ia) => (
                <TableRow key={ia.id}>
                  <TableCell className="font-medium">
                    {ia.instrumentos_clinicos?.nome ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {ia.instrumentos_clinicos?.codigo ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(ia.aplicado_em)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                    {Object.entries(ia.resultados)
                      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DashboardSection>
      )}

      {canEdit && (
        <AplicarInstrumentoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          instrumentos={instrumentos}
          pacienteId={pacienteId}
          aplicadoPor={aplicadoPor}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
