import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/configuracoes/convenios")({
  head: () => ({ meta: [{ title: "Convênios · CB MOVE" }] }),
  component: ConveniosPage,
});

// ─── types ───────────────────────────────────────────────────────────────────

type Convenio = {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
};

// ─── schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  ativo: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

// ─── queries ─────────────────────────────────────────────────────────────────

async function fetchConvenios(): Promise<Convenio[]> {
  const { data, error } = await supabase
    .from("convenios")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Convenio[];
}

async function upsertConvenio(id: string | null, vals: FormValues): Promise<void> {
  const payload = { nome: vals.nome, ativo: vals.ativo };
  if (id) {
    const { error } = await supabase.from("convenios").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("convenios").insert(payload);
    if (error) throw error;
  }
}

async function toggleAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("convenios").update({ ativo }).eq("id", id);
  if (error) throw error;
}

// ─── page ─────────────────────────────────────────────────────────────────────

function ConveniosPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Convenio | null>(null);

  const { data: convenios = [], isLoading } = useQuery({
    queryKey: queryKeys.convenios.all,
    queryFn: fetchConvenios,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", ativo: true },
  });

  const mutation = useMutation({
    mutationFn: (vals: FormValues) => upsertConvenio(editing?.id ?? null, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.convenios.all });
      toast.success(editing ? "Convênio atualizado" : "Convênio criado");
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => toggleAtivo(id, ativo),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.convenios.all }),
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    form.reset({ nome: "", ativo: true });
    setModalOpen(true);
  }

  function openEdit(c: Convenio) {
    setEditing(c);
    form.reset({ nome: c.nome, ativo: c.ativo });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Convênios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie os convênios ativos no sistema</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo convênio
        </Button>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : convenios.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="Nenhum convênio cadastrado"
          description="Adicione o primeiro convênio."
          action={
            <Button onClick={openNew} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Novo convênio
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {convenios.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, ativo: v })}
                      />
                      <span className={cn(
                        "text-xs",
                        c.ativo ? "text-[#047857]" : "text-muted-foreground"
                      )}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>Editar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar convênio" : "Novo convênio"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="ativo" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Ativo</FormLabel>
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
