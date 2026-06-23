import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/fisios")({
  head: () => ({ meta: [{ title: "Fisioterapeutas · CB MOVE" }] }),
  component: FisiosPage,
});

// ─── types ───────────────────────────────────────────────────────────────────

type Fisio = {
  id: string;
  nome: string;
  registro_profissional: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
};

// ─── schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  registro_profissional: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").nullable().optional().or(z.literal("")),
  ativo: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

// ─── queries ──────────────────────────────────────────────────────────────────

async function fetchFisios(): Promise<Fisio[]> {
  const { data, error } = await supabase
    .from("fisioterapeutas")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Fisio[];
}

async function upsertFisio(id: string | null, vals: FormValues): Promise<void> {
  const payload = {
    nome: vals.nome,
    registro_profissional: vals.registro_profissional || null,
    email: vals.email || null,
    ativo: vals.ativo,
  };

  if (id) {
    const { error } = await supabase.from("fisioterapeutas").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("fisioterapeutas").insert(payload);
    if (error) throw error;
  }
}

async function toggleAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("fisioterapeutas").update({ ativo }).eq("id", id);
  if (error) throw error;
}

// ─── page ─────────────────────────────────────────────────────────────────────

function FisiosPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fisio | null>(null);

  const { data: fisios = [], isLoading } = useQuery({
    queryKey: queryKeys.fisioterapeutas.all,
    queryFn: fetchFisios,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", registro_profissional: "", email: "", ativo: true },
  });

  const mutation = useMutation({
    mutationFn: (vals: FormValues) => upsertFisio(editing?.id ?? null, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fisioterapeutas.all });
      toast.success(editing ? "Fisioterapeuta atualizado" : "Fisioterapeuta criado");
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => toggleAtivo(id, ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fisioterapeutas.all });
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fisios.map((f) => (
            <div
              key={f.id}
              className="rounded-xl border bg-card p-5 shadow-sm flex gap-4 items-start"
            >
              {/* Avatar */}
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-cb-cyan-600 flex items-center justify-center text-white font-bold text-sm">
                {initials(f.nome)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground truncate">{f.nome}</p>
                  <span
                    className={cn(
                      "flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
                      f.ativo
                        ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                {f.registro_profissional && (
                  <p className="text-xs text-muted-foreground mt-0.5">CREFITO: {f.registro_profissional}</p>
                )}
                {f.email && (
                  <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <Switch
                    checked={f.ativo}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: f.id, ativo: v })}
                    aria-label="Ativo/Inativo"
                  />
                  <span className="text-xs text-muted-foreground">{f.ativo ? "Ativo" : "Inativo"}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-xs h-7"
                    onClick={() => openEdit(f)}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar fisioterapeuta" : "Novo fisioterapeuta"}</DialogTitle>
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

              <FormField control={form.control} name="registro_profissional" render={({ field }) => (
                <FormItem>
                  <FormLabel>CREFITO</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="CREFITO-3/XXXXX-F" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl>
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
