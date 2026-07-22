import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries/keys";
import {
  deletePeriodizacaoItem,
  fetchPeriodizacaoPaciente,
  proximoNumeroSessao,
  upsertPeriodizacaoItem,
  type PeriodizacaoSessao,
  type PeriodizacaoStatus,
} from "@/lib/queries/periodizacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<PeriodizacaoStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

type Props = { pacienteId: string; readOnly?: boolean };

export function PacientePeriodizacaoTab({ pacienteId, readOnly }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PeriodizacaoSessao | null>(null);
  const [numero, setNumero] = React.useState(1);
  const [objetivo, setObjetivo] = React.useState("");
  const [atividades, setAtividades] = React.useState("");
  const [status, setStatus] = React.useState<PeriodizacaoStatus>("planejada");

  const { data: itens = [], isLoading } = useQuery({
    queryKey: queryKeys.periodizacao.byPaciente(pacienteId),
    queryFn: () => fetchPeriodizacaoPaciente(pacienteId),
    enabled: !!pacienteId,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertPeriodizacaoItem({
        id: editing?.id,
        pacienteId,
        numeroSessao: numero,
        objetivo: objetivo.trim() || null,
        atividadesPrevistas: atividades.trim() || null,
        status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periodizacao.byPaciente(pacienteId) });
      toast.success(editing ? "Sessão atualizada" : "Sessão adicionada ao plano");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePeriodizacaoItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.periodizacao.byPaciente(pacienteId) });
      toast.success("Item removido do plano");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirNovo() {
    setEditing(null);
    setNumero(proximoNumeroSessao(itens));
    setObjetivo("");
    setAtividades("");
    setStatus("planejada");
    setDialogOpen(true);
  }

  function abrirEditar(item: PeriodizacaoSessao) {
    setEditing(item);
    setNumero(item.numeroSessao);
    setObjetivo(item.objetivo ?? "");
    setAtividades(item.atividadesPrevistas ?? "");
    setStatus(item.status);
    setDialogOpen(true);
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Periodização de sessões</h2>
          <p className="text-sm text-muted-foreground">
            Plano clínico ordenado por número de sessão — mesma fonte usada no prontuário.
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar sessão
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão no plano"
          description="Cadastre objetivos e atividades previstas para acompanhar a evolução do tratamento."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Nº</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Atividades</TableHead>
                <TableHead>Status</TableHead>
                {!readOnly && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.numeroSessao}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{item.objetivo ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{item.atividadesPrevistas ?? "—"}</TableCell>
                  <TableCell>{STATUS_LABEL[item.status]}</TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => abrirEditar(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar sessão do plano" : "Nova sessão no plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nº da sessão</Label>
              <Input type="number" min={1} value={numero} onChange={(e) => setNumero(Number(e.target.value))} />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
            </div>
            <div>
              <Label>Atividades previstas</Label>
              <Textarea rows={3} value={atividades} onChange={(e) => setAtividades(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PeriodizacaoStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as PeriodizacaoStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
