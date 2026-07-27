import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MoreHorizontal, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { assertFisiosAccess } from "@/lib/route-access";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { FisioDetalhesSheet } from "@/components/domain/FisioDetalhesSheet";
import { queryKeys } from "@/lib/queries";
import {
  fetchFisios,
  upsertFisio,
  toggleFisioAtivo,
  deleteFisio,
  type Fisio,
  type FisioFormValues,
} from "@/lib/queries/fisioterapeutas";
import { initials } from "@/lib/format";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/fisios")({
  head: () => ({ meta: [{ title: "Fisioterapeutas · CB MOVE" }] }),
  beforeLoad: () => assertFisiosAccess(),
  component: FisiosPage,
});

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  registro_profissional: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").nullable().optional().or(z.literal("")),
  ativo: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function FisiosPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fisio | null>(null);
  const [deleting, setDeleting] = useState<Fisio | null>(null);
  const [viewing, setViewing] = useState<Fisio | null>(null);

  const { data: fisios = [], isLoading } = useQuery({
    queryKey: queryKeys.fisioterapeutas.all,
    queryFn: fetchFisios,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", registro_profissional: "", email: "", ativo: true },
  });

  const mutation = useMutation({
    mutationFn: (vals: FisioFormValues) => upsertFisio(editing?.id ?? null, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fisioterapeutas.all });
      toast.success(editing ? "Fisioterapeuta atualizado" : "Fisioterapeuta criado");
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => toggleFisioAtivo(id, ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fisioterapeutas.all });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFisio(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fisioterapeutas.all });
      toast.success("Fisioterapeuta excluído");
      setDeleting(null);
      setViewing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    form.reset({ nome: "", registro_profissional: "", email: "", ativo: true });
    setModalOpen(true);
  }

  function openEdit(f: Fisio) {
    setEditing(f);
    form.reset({
      nome: f.nome,
      registro_profissional: f.registro_profissional ?? "",
      email: f.email ?? "",
      ativo: f.ativo,
    });
    setViewing(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Fisioterapeutas</h1>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo fisio
        </Button>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : fisios.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Nenhum fisioterapeuta cadastrado"
          description="Adicione o primeiro fisioterapeuta da equipe."
          action={
            <Button onClick={openNew} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Novo fisio
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CREFITO</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fisios.map((f) => (
                <TableRow key={f.id} className="cursor-pointer" onClick={() => setViewing(f)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cb-cyan-600 text-xs font-bold text-white">
                        {initials(f.nome)}
                      </div>
                      <span className="text-cb-cyan-800">{f.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.registro_profissional || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.email || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={f.ativo}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: f.id, ativo: v })}
                        aria-label="Ativo/Inativo"
                      />
                      <span
                        className={cn(
                          "text-xs",
                          f.ativo ? "text-[#047857]" : "text-muted-foreground",
                        )}
                      >
                        {f.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewing(f)}>
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(f)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleting(f)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FisioDetalhesSheet
        fisio={viewing}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
        onDelete={(f) => setDeleting(f)}
      />

      {/* Modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={(o) => {
          if (!o) closeModal();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar fisioterapeuta" : "Novo fisioterapeuta"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registro_profissional"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CREFITO</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="CREFITO-3/XXXXX-F" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Ativo</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
            <AlertDialogTitle>Excluir fisioterapeuta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome}</strong>? Só é possível
              excluir fisioterapeutas sem sessões ou agendamentos vinculados. Caso já tenha
              histórico, use o botão Ativo/Inativo.
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
