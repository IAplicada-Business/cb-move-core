import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { assertMenuAccess } from "@/lib/route-access";
import { LoadingState } from "@/components/domain/LoadingState";
import { BrandTableShell } from "@/components/brand/BrandTable";
import { ConfiguracoesModuleHeader } from "@/components/layout/ConfiguracoesLayout";
import { DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

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
  FormDescription,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/configuracoes/convenios")({
  head: () => ({ meta: [{ title: "Convênios · CB MOVE" }] }),
  beforeLoad: () => assertMenuAccess("cfg.convenios"),
  component: ConveniosPage,
});

// ─── types ───────────────────────────────────────────────────────────────────

type Convenio = {
  id: string;
  nome: string;
  ativo: boolean;
  cnpj: string | null;
  razao_social: string | null;
  email_nf: string | null;
  email_envio: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_municipio_ibge: number | null;
  created_at: string;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCnpjDisplay(cnpj: string | null | undefined): string {
  const d = onlyDigits(cnpj ?? "");
  if (d.length !== 14) return cnpj ?? "—";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function fiscalCompleto(c: Convenio): boolean {
  return !!(c.cnpj && c.razao_social && c.email_nf);
}

// ─── schema ───────────────────────────────────────────────────────────────────

const optionalEmail = z.string().email("E-mail inválido").optional().or(z.literal(""));

const schema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  ativo: z.boolean(),
  cnpj: z
    .string()
    .optional()
    .refine((v) => !v || onlyDigits(v).length === 14, "CNPJ deve ter 14 dígitos"),
  razao_social: z.string().optional(),
  email_nf: optionalEmail,
  email_envio: optionalEmail,
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2, "UF com 2 letras").optional(),
  codigo_municipio_ibge: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{7}$/.test(v), "Código IBGE com 7 dígitos"),
});
type FormValues = z.infer<typeof schema>;

function toPayload(vals: FormValues) {
  const ibge = vals.codigo_municipio_ibge?.trim();
  return {
    nome: vals.nome.trim(),
    ativo: vals.ativo,
    cnpj: vals.cnpj?.trim() ? onlyDigits(vals.cnpj) : null,
    razao_social: vals.razao_social?.trim() || null,
    email_nf: vals.email_nf?.trim() || null,
    email_envio: vals.email_envio?.trim() || null,
    endereco: vals.endereco?.trim() || null,
    numero: vals.numero?.trim() || null,
    complemento: vals.complemento?.trim() || null,
    bairro: vals.bairro?.trim() || null,
    cep: vals.cep?.trim() ? onlyDigits(vals.cep) : null,
    cidade: vals.cidade?.trim() || null,
    uf: vals.uf?.trim().toUpperCase() || null,
    codigo_municipio_ibge: ibge ? Number(ibge) : null,
  };
}

// ─── queries ─────────────────────────────────────────────────────────────────

async function fetchConvenios(): Promise<Convenio[]> {
  const { data, error } = await supabase
    .from("convenios")
    .select(
      "id, nome, ativo, cnpj, razao_social, email_nf, email_envio, endereco, numero, complemento, bairro, cep, cidade, uf, codigo_municipio_ibge, created_at",
    )
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Convenio[];
}

async function upsertConvenio(id: string | null, vals: FormValues): Promise<void> {
  const payload = toPayload(vals);
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

async function deleteConvenio(id: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("pacientes")
    .select("id", { count: "exact", head: true })
    .eq("convenio_id", id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error(
      "Este convênio está vinculado a pacientes cadastrados e não pode ser excluído. Use o botão Ativo/Inativo.",
    );
  }
  const { error } = await supabase.from("convenios").delete().eq("id", id);
  if (error) throw error;
}

const defaultForm: FormValues = {
  nome: "",
  ativo: true,
  cnpj: "",
  razao_social: "",
  email_nf: "",
  email_envio: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  cidade: "",
  uf: "",
  codigo_municipio_ibge: "",
};

function convenioToForm(c: Convenio): FormValues {
  return {
    nome: c.nome,
    ativo: c.ativo,
    cnpj: c.cnpj ? formatCnpjDisplay(c.cnpj) : "",
    razao_social: c.razao_social ?? "",
    email_nf: c.email_nf ?? "",
    email_envio: c.email_envio ?? "",
    endereco: c.endereco ?? "",
    numero: c.numero ?? "",
    complemento: c.complemento ?? "",
    bairro: c.bairro ?? "",
    cep: c.cep ?? "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    codigo_municipio_ibge: c.codigo_municipio_ibge != null ? String(c.codigo_municipio_ibge) : "",
  };
}

// ─── page ─────────────────────────────────────────────────────────────────────

function ConveniosPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Convenio | null>(null);
  const [deleting, setDeleting] = useState<Convenio | null>(null);

  const { data: convenios = [], isLoading } = useQuery({
    queryKey: queryKeys.convenios.all,
    queryFn: fetchConvenios,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultForm,
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConvenio(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.convenios.all });
      toast.success("Convênio excluído");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    form.reset(defaultForm);
    setModalOpen(true);
  }

  function openEdit(c: Convenio) {
    setEditing(c);
    form.reset(convenioToForm(c));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-5">
      <ConfiguracoesModuleHeader
        title="Convênios"
        description="Cadastro fiscal para NFS-e (tomador) e envio de documentação"
        actions={
          <Button onClick={openNew} className="gap-2 bg-cb-cyan-600 hover:bg-cb-cyan-700">
            <Plus className="h-4 w-4" /> Novo convênio
          </Button>
        }
      />

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
        <BrandTableShell
          eyebrow="Convênios"
          accent="cyan"
          title="Cadastrados"
          badge={<DashboardSectionBadge accent="cyan">{convenios.length}</DashboardSectionBadge>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>E-mails</TableHead>
                <TableHead>Fiscal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {convenios.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatCnpjDisplay(c.cnpj)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {c.email_envio ?? c.email_nf ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        fiscalCompleto(c)
                          ? "border-emerald-500/40 text-emerald-800"
                          : "border-cb-orange/40 text-cb-orange",
                      )}
                    >
                      {fiscalCompleto(c) ? "Completo" : "Incompleto"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, ativo: v })}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          c.ativo ? "text-[#047857]" : "text-muted-foreground",
                        )}
                      >
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
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleting(c)}
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
        </BrandTableShell>
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(o) => {
          if (!o) closeModal();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar convênio" : "Novo convênio"}</DialogTitle>
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00.000.000/0000-00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="razao_social"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão social</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email_nf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail tomador (NFS-e)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="tomador@convenio.com" />
                    </FormControl>
                    <FormDescription>Vai na nota fiscal enviada à Focus.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email_envio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail envio (documentação)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="logjur@convenio.com" />
                    </FormControl>
                    <FormDescription>
                      Destino do e-mail/n8n. Se vazio, usa o e-mail tomador.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="endereco"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Endereço (logradouro)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="AV RIO DE JANEIRO" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="555" />
                      </FormControl>
                      <FormDescription>Obrigatório p/ NFS-e.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Sala 801" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00000-000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={2} placeholder="RS" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="codigo_municipio_ibge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código município IBGE</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="4314902" />
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
            <AlertDialogTitle>Excluir convênio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome}</strong>? Só é possível
              excluir convênios sem pacientes vinculados. Caso já tenha pacientes, use o botão
              Ativo/Inativo.
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
