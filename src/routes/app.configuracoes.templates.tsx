import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, FolderOpen, Mail, MoreHorizontal, Receipt } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { BrandTableShell } from "@/components/brand/BrandTable";
import { ConfiguracoesModuleHeader } from "@/components/layout/ConfiguracoesLayout";
import { TemplatePreviewPanel } from "@/components/domain/TemplatePreviewPanel";
import { queryKeys } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { assertMenuAccess } from "@/lib/route-access";
import {
  CATEGORIA_META,
  categoriasTemplatesVisiveis,
  filtrarTemplatesPorCategoria,
  MODELO_LABEL,
  TEMPLATES_PAGE_DESCRICAO,
  TIPO_LABEL,
} from "@/lib/domain/templates-versionados";
import { isTemplateConteudoRascunho } from "@/lib/domain/template-preview";

import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/configuracoes/templates")({
  head: () => ({ meta: [{ title: "Templates versionados · CB MOVE" }] }),
  beforeLoad: () => assertMenuAccess("cfg.templates"),
  component: TemplatesPage,
});

type Template = {
  id: string;
  codigo: string;
  tipo: string;
  modelo: string | null;
  versao: number;
  ativo: boolean;
  created_at: string;
  conteudo: unknown;
};

async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from("templates_versionados")
    .select("*")
    .order("tipo")
    .order("versao", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Template[];
}

async function updateTemplateAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("templates_versionados").update({ ativo }).eq("id", id);
  if (error) throw error;
}

async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("templates_versionados").delete().eq("id", id);
  if (error) throw error;
}

function TemplatesPage() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Template | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [editAtivo, setEditAtivo] = useState(true);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: queryKeys.templates.all,
    queryFn: fetchTemplates,
  });

  const updateMutation = useMutation({
    mutationFn: () => updateTemplateAtivo(editing!.id, editAtivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success("Template atualizado");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success("Template excluído");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(t: Template) {
    setEditing(t);
    setEditAtivo(t.ativo);
  }

  const categoriasVisiveis = categoriasTemplatesVisiveis(templates);

  function renderTabela(items: Template[]) {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum template nesta categoria"
          description="Não há registros versionados para este grupo."
        />
      );
    }

    return (
      <BrandTableShell eyebrow="Templates" accent="cyan" title="Versões cadastradas">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.codigo}</TableCell>
                <TableCell className="text-sm">{TIPO_LABEL[t.tipo] ?? t.tipo}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.modelo ? (MODELO_LABEL[t.modelo] ?? t.modelo) : "—"}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    v{t.versao}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                      t.ativo
                        ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {t.ativo ? "Ativo" : "Inativo"}
                  </span>
                  {isTemplateConteudoRascunho(t.tipo, t.conteudo) && (
                    <span className="ml-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Rascunho
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(t.created_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPreview(t)}>Visualizar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(t)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleting(t)}
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
    );
  }

  return (
    <div className="space-y-5">
      <ConfiguracoesModuleHeader
        title="Templates versionados"
        description={TEMPLATES_PAGE_DESCRICAO}
      />

      {isLoading ? (
        <LoadingState />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum template encontrado"
          description="Nenhum template versionado cadastrado no sistema."
        />
      ) : (
        <Tabs defaultValue="nota_fiscal" className="space-y-4">
          <TabsList>
            {categoriasVisiveis.map((cat) => {
              const CatIcon =
                cat === "nota_fiscal"
                  ? Receipt
                  : cat === "email_nf"
                    ? Mail
                    : cat === "relatorio_atendimento"
                      ? FileText
                      : FolderOpen;
              return (
                <TabsTrigger key={cat} value={cat}>
                  <CatIcon className="h-4 w-4 shrink-0" />
                  {CATEGORIA_META[cat].label} ({filtrarTemplatesPorCategoria(templates, cat).length}
                  )
                </TabsTrigger>
              );
            })}
          </TabsList>
          {categoriasVisiveis.map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-3">
              <p className="text-sm text-muted-foreground">{CATEGORIA_META[cat].descricao}</p>
              {renderTabela(filtrarTemplatesPorCategoria(templates, cat))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar template</DialogTitle>
          </DialogHeader>
          {preview && (
            <TemplatePreviewPanel
              codigo={preview.codigo}
              versao={preview.versao}
              modelo={preview.modelo}
              tipo={preview.tipo}
              conteudo={preview.conteudo}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar template</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Switch checked={editAtivo} onCheckedChange={setEditAtivo} id="template-ativo" />
            <Label htmlFor="template-ativo">Ativo</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
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
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template <strong>{deleting?.codigo}</strong> v
              {deleting?.versao}? Relatórios que dependem deste código podem deixar de funcionar.
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
