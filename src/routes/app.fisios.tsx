import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { assertFisiosAccess } from "@/lib/route-access";

import { EmptyState } from "@/components/domain/EmptyState";
import { FisioCardGrid } from "@/components/domain/FisioCardGrid";
import { LoadingState } from "@/components/domain/LoadingState";
import { KpiCard } from "@/components/domain/KpiCard";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { PageHeader } from "@/components/brand/PageHeader";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

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

  const ativos = fisios.filter((f) => f.ativo).length;
  const inativos = fisios.length - ativos;

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Equipe" }, { label: "Fisioterapeutas" }]}
        title="Fisioterapeutas"
        description="Equipe clínica, horários e disponibilidade na agenda"
        actions={
          <Button onClick={openNew} className="gap-2 bg-cb-cyan-600 hover:bg-cb-cyan-700">
            <Plus className="h-4 w-4" /> Novo fisio
          </Button>
        }
      />

      {fisios.length > 0 && (
        <KpiGrid columns={3}>
          <KpiCard
            label="Total"
            value={fisios.length}
            accent="cyan"
            icon={<Users className="h-5 w-5" />}
          />
          <KpiCard
            label="Ativos"
            value={ativos}
            accent="lime"
            icon={<Users className="h-5 w-5" />}
            share={fisios.length > 0 ? (ativos / fisios.length) * 100 : 0}
          />
          <KpiCard
            label="Inativos"
            value={inativos}
            accent="orange"
            icon={<Users className="h-5 w-5" />}
          />
        </KpiGrid>
      )}

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
        <DashboardSection
          eyebrow="Equipe"
          accent="cyan"
          title="Fisioterapeutas"
          badge={<DashboardSectionBadge accent="cyan">{fisios.length}</DashboardSectionBadge>}
          noPadding
        >
          <FisioCardGrid
            fisios={fisios}
            onOpen={setViewing}
            onEdit={openEdit}
            onDelete={setDeleting}
            onToggleAtivo={(id, ativo) => toggleMutation.mutate({ id, ativo })}
          />
        </DashboardSection>
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
    </DashboardPage>
  );
}
