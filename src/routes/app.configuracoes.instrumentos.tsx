import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlaskConical, Eye, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { BrandTableShell } from "@/components/brand/BrandTable";
import { DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/configuracoes/instrumentos")({
  head: () => ({ meta: [{ title: "Instrumentos clínicos · CB MOVE" }] }),
  component: InstrumentosPage,
});

type CampoInstrumento = {
  id: string;
  label: string;
  tipo: string;
  opcoes?: string[];
  min?: number;
  max?: number;
};

type Instrumento = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  versao: number;
  status: string;
  campos: CampoInstrumento[] | null;
};

async function fetchInstrumentos(): Promise<Instrumento[]> {
  const { data, error } = await supabase
    .from("instrumentos_clinicos")
    .select("id, codigo, nome, categoria, descricao, versao, status, campos")
    .order("categoria")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as unknown as Instrumento[];
}

async function updateInstrumento(
  id: string,
  vals: { nome: string; descricao: string | null; status: string },
): Promise<void> {
  const { error } = await supabase
    .from("instrumentos_clinicos")
    .update({ nome: vals.nome, descricao: vals.descricao, status: vals.status })
    .eq("id", id);
  if (error) throw error;
}

async function deleteInstrumento(id: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("instrumentos_aplicados")
    .select("id", { count: "exact", head: true })
    .eq("instrumento_id", id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error(
      "Este instrumento já foi aplicado em prontuários e não pode ser excluído. Altere o status para inativo.",
    );
  }
  const { error } = await supabase.from("instrumentos_clinicos").delete().eq("id", id);
  if (error) throw error;
}

const TIPO_LABEL: Record<string, string> = {
  select: "Seleção",
  number: "Número",
  textarea: "Texto longo",
  text: "Texto",
};

function CamposDialog({
  instrumento,
  onClose,
}: {
  instrumento: Instrumento | null;
  onClose: () => void;
}) {
  if (!instrumento) return null;
  const campos = instrumento.campos ?? [];

  return (
    <Dialog
      open={!!instrumento}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {instrumento.nome}{" "}
            <span className="text-muted-foreground font-normal text-sm">
              — {instrumento.codigo}
            </span>
          </DialogTitle>
        </DialogHeader>
        {instrumento.descricao && (
          <p className="text-sm text-muted-foreground">{instrumento.descricao}</p>
        )}
        <div className="space-y-3 mt-2">
          {campos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sem campos configurados.</p>
          ) : (
            campos.map((campo) => (
              <div key={campo.id} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{campo.label}</span>
                  <span className="text-xs rounded-full bg-muted px-2 py-0.5 font-mono">
                    {TIPO_LABEL[campo.tipo] ?? campo.tipo}
                  </span>
                </div>
                {campo.tipo === "number" &&
                  (campo.min !== undefined || campo.max !== undefined) && (
                    <p className="text-xs text-muted-foreground">
                      Intervalo: {campo.min ?? "—"} a {campo.max ?? "—"}
                    </p>
                  )}
                {campo.opcoes && campo.opcoes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {campo.opcoes.map((op) => (
                      <span
                        key={op}
                        className="text-xs rounded-md border bg-background px-2 py-0.5"
                      >
                        {op}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InstrumentosPage() {
  const qc = useQueryClient();
  const { data: instrumentos = [], isLoading } = useQuery({
    queryKey: queryKeys.instrumentos.all,
    queryFn: fetchInstrumentos,
  });

  const [viewingInstrumento, setViewingInstrumento] = useState<Instrumento | null>(null);
  const [editing, setEditing] = useState<Instrumento | null>(null);
  const [deleting, setDeleting] = useState<Instrumento | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", descricao: "", status: "ativo" });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateInstrumento(editing!.id, {
        nome: editForm.nome.trim(),
        descricao: editForm.descricao.trim() || null,
        status: editForm.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.instrumentos.all });
      toast.success("Instrumento atualizado");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInstrumento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.instrumentos.all });
      toast.success("Instrumento excluído");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(inst: Instrumento) {
    setEditing(inst);
    setEditForm({
      nome: inst.nome,
      descricao: inst.descricao ?? "",
      status: inst.status,
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Instrumentos clínicos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Catálogo de instrumentos de avaliação neurológica
        </p>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : instrumentos.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title="Sem instrumentos cadastrados"
          description="Nenhum instrumento de avaliação neurológica cadastrado ainda."
        />
      ) : (
        <BrandTableShell
          eyebrow="Catálogo"
          accent="purple"
          title="Instrumentos clínicos"
          badge={
            <DashboardSectionBadge accent="purple">{instrumentos.length}</DashboardSectionBadge>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {instrumentos.map((inst) => {
                const numCampos = Array.isArray(inst.campos) ? inst.campos.length : 0;
                return (
                  <TableRow key={inst.id}>
                    <TableCell className="font-mono text-xs">{inst.codigo}</TableCell>
                    <TableCell className="font-medium">{inst.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inst.categoria}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        v{inst.versao}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                          inst.status === "ativo"
                            ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {inst.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-8"
                        onClick={() => setViewingInstrumento(inst)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver campos
                      </Button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(inst)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(inst)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </BrandTableShell>
      )}

      <CamposDialog instrumento={viewingInstrumento} onClose={() => setViewingInstrumento(null)} />

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar instrumento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={editForm.nome}
                onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={editForm.descricao}
                onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={updateMutation.isPending || !editForm.nome.trim()}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir instrumento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome}</strong>? Só é possível
              excluir instrumentos que nunca foram aplicados em prontuários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
